'use strict';

const timestamp = false;

let
	fs = require('fs'),
	path = require('path'),
	exec = require('child_process').exec,
	spawn = require('child_process').spawn,
	util = require('util'),
	EventEmitter = require('events'),
	// LG TV
	lgtv = require('lgtv2/index.js')({
		url: 'ws://192.168.1.105:3000'
	}),
	// NVIDIA Shield
	nvidiaShieldAdb = require('nvidia-shield-adb'),
	shield = new nvidiaShieldAdb('192.168.1.106'),
	// Broadlink MP1 and  RM Plus
	broadlink = require('broadlinkjs'),
	broadlinks = new broadlink(),
	// NVIDIA Shield
	powerStateWithPing = require('power-state-with-ping'),
	nswitch = new powerStateWithPing('192.168.1.110', 10000),
	// Costume vars
	devices = {}
;

let app_stereo = [
	"com.google.android.apps.mediashell",
	"com.ionitech.airscreen",
	"com.cloudmosa.puffinTV",
	"com.android.chrome",
	"com.nickonline.android.nickapp",
	"com.nvidia.bbciplayer",
	"com.google.android.youtube.tv",
	"com.turner.cnvideoapp",
	"com.webos.app.livetv",
	"com.apple.android.music",
	"youtube.leanback.v4"
];


function getDateTime() {
    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    if (timestamp) return year + ":" + month + ":" + day + ":" + hour + ":" + min + ":" + sec;
    else return "";
}


// Make some object for all devices
devices.emitter = new EventEmitter();
devices.on = devices.emitter.on;
devices.emit = devices.emitter.emit;
devices.lg = null;
devices.shield = null;
devices.mp1 = null;
devices.rmplus = null;
devices.nswitch = null;


console.log('\n\x1b[4mConnecting...\x1b[0m', "\n");


// Connect to Nintendo Switch
nswitch.debug = false;
nswitch.hdmi = "com.webos.app.hdmi2";
nswitch.on('ready', function() {
	devices.nswitch = this;

	console.log("\x1b[33mSW\x1b[0m: \x1b[1mConnected\x1b[0m", getDateTime());
});
nswitch.connect(false);

// Connect to NVIDIA Shield
shield.debug = false;
shield.hdmi = "com.webos.app.hdmi1";
shield.on('ready', function() {
	devices.shield = this;
	console.log("\x1b[32mNS\x1b[0m: \x1b[1mConnected\x1b[0m", getDateTime());
});
shield.connect(false);

// Connect to Broadlink RM Plus, for Reciever IR blaster
// Connect to Broadlink MP1, for Reciever Power
broadlinks.on("deviceReady", (dev) => {
	if (dev.type == "RM2") {
		function bufferFile(relPath) {
			return fs.readFileSync(path.join(__dirname, relPath));
		}

		devices.rmplus = dev;
		devices.rmplus.sendCode = function() {
			var argv = arguments,
				i= 0,
				loop = setInterval(() => {
					dev.sendData(bufferFile("code/" + argv[i++] + ".bin"));
					if (i >= argv.length) clearInterval(loop);
				}, 500);
		}

		console.log("\x1b[35mRP\x1b[0m: \x1b[1mConnected\x1b[0m", getDateTime());
	} else if (dev.type == "MP1") {
		devices.mp1 = dev;
		console.log("\x1b[33mMP\x1b[0m: \x1b[1mConnected\x1b[0m", getDateTime());
	}
});
broadlinks.discover();

// Connect to LG TV
lgtv.on('connect', () => {
	devices.lg = {};
	devices.lg.appId = "";
	devices.lg.emitter = new EventEmitter();
	devices.lg.on = devices.lg.emitter.on;
	devices.lg.emit = devices.lg.emitter.emit;

	if(this.force_emit) {
		this.force_emit = false;
		devices.emit('ready');
	}

	console.log("\x1b[36mTV\x1b[0m: \x1b[1mConnected\x1b[0m", getDateTime());
});
// Prompt for security code
lgtv.on('prompt', () => {
	console.log('\x1b[36mTV\x1b[0m: Please authorize on LG TV');
});
lgtv.on('close', () => {
	this.force_emit = true;
	if(this.lg != null) this.lg.appId = "";
	console.log('\x1b[36mTV\x1b[0m: Close', getDateTime());
});
lgtv.on('error', (err) => {
	this.force_emit = true;
	console.log("\x1b[36mTV\x1b[0m: TV -> No Response");
});


// When all devices is on
devices.on('ready', function() {
	console.log('\n\x1b[4mAll devices are ready\x1b[0m', "\n");
	lgtv.request('ssap://system.notifications/createToast', {message: "All devices are connected"});

	lgtv.subscribe('ssap://com.webos.applicationManager/getForegroundAppInfo', (err, res) => {
		if (res.appId == "") console.log("\x1b[36mTV\x1b[0m: TV -> \x1b[2mSleep\x1b[0m");
		else {
			if(devices.lg.appId == "") console.log(`\x1b[36mTV\x1b[0m: TV -> \x1b[1mWake\x1b[0m`);
			console.log(`\x1b[36mTV\x1b[0m: TV app -> \x1b[4m\x1b[37m${res.appId}\x1b[0m`);
		}
		devices.lg.appId = res.appId;

		// If TV state change, trigger RM Plus event, to power on/off reciever
		clearTimeout(this.mp1.timer);
		this.mp1.timer = setTimeout(() => {
			this.mp1.check_power();
		}, 3000);

		// This just a failsafe if the reciever didn't switch it automatically
		if (res.appId == this.nswitch.hdmi) {
			// Set reciever to Switch input
			this.rmplus.sendCode("inputswitch");
		} else {
			// Set reciever to TV input
			this.rmplus.sendCode("inputtv");
		}

		clearTimeout(this.shield.timer);
		this.shield.timer = setTimeout(() => {
			// If input is hdmi1 make NVIDIA Shield awake
			if (res.appId == this.shield.hdmi) {
				if (this.shield.is_sleep) this.shield.wake();
			}
			// And the if need to be seperated somehow
			// If TV state change, trigger RM Plus event
			if(res.appId != this.shield.hdmi) {
				if (!this.shield.is_sleep) this.shield.sleep();
			}
		}, 1500);

		// Change sound mode in receiver
		if(res.appId != "" && res.appId != this.shield.hdmi) this.current_media_app = res.appId;

		this.rmplus.emit("changevolume");
	});
});
// When all devices except TV is on
devices.on('mostready', function() {
	console.log('\n\x1b[4mMost devices are ready\x1b[0m', "\n");


	// Pioner Reciever IR Command

	this.rmplus.on("changevolume", (data) => {
		var dev = this.rmplus,
			appid = this.lg.appId;

		clearTimeout(this.rmplus.timer);
		this.rmplus.timer = setTimeout(() => {
			// Check LG TV and NVIDIA Shield Active app
			// Set reciever mode based on the stereo list
			if (app_stereo.includes(this.current_media_app)) {
				// Set reciever mode to extra-stereo
				if(dev.sound_mode != "stereo") {
					dev.sound_mode = "stereo";
					dev.sendCode("soundalc", "soundstereo"); // Add longer delay
					console.log("\x1b[35mRP\x1b[0m: Sound is -> \x1b[4m\x1b[37mStereo Sound\x1b[0m");
					lgtv.request('ssap://system.notifications/createToast', {message: "Sound is Extra Stereo"});
				}
			} else if (appid != "") {
				// Set reciever mode to auto surround sound for other
				if(dev.sound_mode != "soundauto") {
					dev.sound_mode = "soundauto";
					dev.sendCode("soundalc", "soundauto"); // Add longer delay
					console.log("\x1b[35mRP\x1b[0m: Sound is -> \x1b[4m\x1b[37mSurround Sound\x1b[0m");
					lgtv.request('ssap://system.notifications/createToast', {message: "Sound is Auto Surround"});
				}
			}
		}, 1500);
	});

	// Pioner Reciever Power

	this.mp1.on("mp_power", (status_array) => {
		// Device id is array index + 1
		// When TV is on turn on switch #3 but with a bit of delay
		// so TV turn off sound didn't cut
		if (this.lg.appId != "")  {
			// TV is on, turn on reciever when reciever is off
			if(!status_array[2]) {
				this.mp1.set_power(3,1);
				console.log("\x1b[33mMP\x1b[0m: Broadlink MP1 Switch #3 -> \x1b[1mON\x1b[0m")
			}
		} else {
			// TV is off, turn off reciever when reciever is on
			setTimeout(() => {
				if(status_array[2]) {
					this.mp1.set_power(3,0);
					console.log("\x1b[33mMP\x1b[0m: Broadlink MP1 Switch #3 -> \x1b[2mOFF\x1b[0m")
				}
			}, 1000);
		}
	});


	// NVIDIA Switch

	this.shield.status((status) => {
		this.shield.is_sleep = !status;
		if(!this.shield.is_sleep) console.log("\x1b[32mNS\x1b[0m: NVIDIA Shield -> \x1b[1mWake\x1b[0m");
		else console.log("\x1b[32mNS\x1b[0m: NVIDIA Shield -> \x1b[2mSleep\x1b[0m");
	});

	this.shield.currentappchange_firstrun = true;
	this.shield.on('currentappchange', (currentapp) => {
		if(this.lg == null) this.lg = { appId: "" };

		// If shield and tv are sleep while current app change, wake up everything
		console.log("NS: Status", this.lg.appId, this.shield.is_sleep);
		if (this.lg.appId == "" && !this.shield.currentappchange_firstrun) {
			// Wake up shield
			if (this.shield.is_sleep) this.shield.wake();

			// Need to have delay
			setTimeout(() => {
				// Wake up tv and then the reciever automatically
				if(this.lg.appId == "") this.rmplus.sendCode("tvpower");

				// Set input to HDMI1
				lgtv.request('ssap://system.launcher/launch', {id: this.shield.hdmi});
			}, 1000);
		}
		this.shield.currentappchange_firstrun  = false;

		console.log(`\x1b[32mNS\x1b[0m: Shield active app -> \x1b[4m\x1b[37m${currentapp}\x1b[0m`);
	});

	this.shield.on('currentmediaappchange', (currentapp) => {
		// If current media app change, trigger RM Plus event, to change sound mode in receiver
		this.current_media_app = currentapp;
		this.rmplus.emit("changevolume");

		if(this.current_media_app == "com.ionitech.airscreen") {
			// Delay 15 seconds
			// hit right and enter to remove ads
		}

		console.log(`\x1b[32mNS\x1b[0m: Shield active media app -> \x1b[4m\x1b[37m${this.current_media_app}\x1b[0m`);
	});

	this.shield.on('awake', () => {
		this.shield.is_sleep = false;

		if(this.lg == null) this.lg = { appId: "" };

		if(this.lg.appId == "") {
			// Thus can make TV sleep, as appID could be slower to retrieve -> Fix with force emit in TV close and error
			// Wake up tv and then the reciever automatically
			this.rmplus.sendCode("tvpower");
		}

		// Set input to HDMI1
		lgtv.request('ssap://system.launcher/launch', {id: this.shield.hdmi});

		setTimeout(() => {
			// Set reciever to TV input
			this.rmplus.sendCode("inputtv");
		}, 1000);

		console.log("\x1b[32mNS\x1b[0m: NVIDIA Shield -> \x1b[1mWake\x1b[0m");
		lgtv.request('ssap://system.notifications/createToast', {message: "Switching to NVIDIA Shield"});
	});

	this.shield.on('sleep', () => {
		this.shield.is_sleep = true;

		if(this.lg == null) this.lg = { appId: "" };

		// If Shield is sleeping while in input HDMI1 then turn off TV
		if(this.lg.appId == this.shield.hdmi) {
			this.current_media_app = "";
			// Turn off tv and then the reciever automatically
			lgtv.request('ssap://system/turnOff');
		}
		console.log("\x1b[32mNS\x1b[0m: NVIDIA Shield -> \x1b[2mSleep\x1b[0m");
	});

	this.shield.subscribe();


	// Nintendo Switch

	this.nswitch.on('awake', (current_app) => {
		console.log("\x1b[33mSW\x1b[0m: Nintendo Switch -> \x1b[1mWake\x1b[0m");
		lgtv.request('ssap://system.notifications/createToast', {message: "Switching to Nintendo Switch"});

		if(this.lg == null) this.lg = { appId: "" };

		// Wake up tv and then the reciever automatically
		if(this.lg.appId == "") this.rmplus.sendCode("tvpower");

		// Switch to Pioneer input
		lgtv.request('ssap://system.launcher/launch', {id: this.nswitch.hdmi});

		setTimeout(() => {
			// Set reciever to Switch input
			this.rmplus.sendCode("inputswitch");
		}, 1000);
	});

	this.nswitch.on('sleep', (current_app) => {
		console.log("\x1b[33mSW\x1b[0m: Nintendo Switch -> \x1b[2mSleep\x1b[0m");

		if(this.lg == null) this.lg = { appId: "" };

		// If Switch is sleeping while in input HDMI2 then turn off TV
		if(this.lg.appId == this.nswitch.hdmi) {
			this.current_media_app = "";
			// Turn off tv and then the reciever automatically
			lgtv.request('ssap://system/turnOff');
		}
	});

	this.nswitch.subscribe();
});
// At the beginning loop until all devices are connected
devices.mostready = false;
let devicecheck = setInterval(() => {
	if (devices.lg != null && devices.nswitch != null && devices.mp1 != null && devices.rmplus != null && devices.shield != null) {
		if(!devices.mostready) devices.emit('mostready');
		devices.emit('ready');
		clearInterval(devicecheck);
	} else if (devices.nswitch != null && devices.mp1 != null && devices.mp1 != null && devices.rmplus != null && devices.shield != null) {
		this.force_emit = true;
		devices.emit('mostready');
		devices.mostready = false;
		clearInterval(devicecheck);
	}
}, 1000);