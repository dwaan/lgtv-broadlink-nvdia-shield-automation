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


console.log('\n\x1b[4mConnecting...\x1b[0m', "\n");


// Connect to NVIDIA Shield
shield.debug = false;
shield.connect(false);
shield.on('ready', function() {
	devices.shield = this;
	devices.shield.hdmi = "com.webos.app.hdmi1";
	console.log("\x1b[32mNS\x1b[0m: \x1b[1mConnected\x1b[0m", getDateTime());
});

// Connect to Broadlink RM Plus, for Reciever IR blaster
// Connect to Broadlink MP1, for Reciever Power
broadlinks.on("deviceReady", (dev) => {
	if (dev.type == "DEVICE") {
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
				}, 250);
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
	this.lg.appId = "";
	console.log('\x1b[36mTV\x1b[0m: Close', getDateTime());
});
lgtv.on('error', (err) => {
	this.force_emit = true;
	console.log("\x1b[36mTV\x1b[0m: TV -> No Response");
});


// When all devices is on
devices.on('ready', function() {
	console.log('\n\x1b[4mAll devices are ready\x1b[0m', "\n");

	lgtv.subscribe('ssap://com.webos.applicationManager/getForegroundAppInfo', (err, res) => {
		if (res.appId == "") console.log("\x1b[36mTV\x1b[0m: TV -> \x1b[1mSleep\x1b[0m");
		else {
			if(devices.lg.appId == "") console.log(`\x1b[36mTV\x1b[0m: TV -> \x1b[1mWake\x1b[0m`);
			console.log(`\x1b[36mTV\x1b[0m: TV app -> \x1b[4m\x1b[37m${res.appId}\x1b[0m`);
		}
		devices.lg.appId = res.appId;
		devices.lg.emit('currentappchange', res);
	});

	this.lg.on('currentappchange', (res) => {
		// If TV state change, trigger RM Plus event, to power on/off reciever
		this.mp1.check_power();

		if (res.appId == this.shield.hdmi) {
			// If input is hdmi1
			// - Make NVIDIA Shield awake
			// - Change sound mode based on NVIDIA Shield active app
			if (this.shield.is_sleep) this.shield.wake();
		} else {
			// If TV state change,
			// - Trigger RM Plus event
			// - Change sound mode in receiver
			if (!this.shield.is_sleep) this.shield.sleep();
		}

		if(res.appId != "" && res.appId != this.shield.hdmi) this.current_media_app = res.appId;
		this.rmplus.checkData();
	});
});
// When all devices except TV is on
devices.on('mostready', function() {
	console.log('\n\x1b[4mMost devices are ready\x1b[0m', "\n");

	this.rmplus.on("rawData", (data) => {
		var dev = this.rmplus,
			appid = this.lg.appId;

		// Check LG TV and NVIDIA Shield Active app
		// Set reciever mode based on the stereo list
		if (app_stereo.includes(this.current_media_app)) {
			// Set reciever mode to extra-stereo
			if(dev.sound_mode != "surround") {
				dev.sound_mode = "surround";
				dev.sendCode("soundalc", "soundstereo", "volumedown", "volumedown", "volumedown", "volumedown", "volumedown");
				console.log("\x1b[35mRP\x1b[0m: Sound is -> \x1b[4m\x1b[37mStereo Sound\x1b[0m");
			}
		} else if (appid != "") {
			// Set reciever mode to auto surround sound for other
			if(dev.sound_mode != "stereo") {
				dev.sound_mode = "stereo";
				dev.sendCode("soundalc", "soundauto", "volumeup", "volumeup", "volumeup", "volumeup", "volumeup");
				console.log("\x1b[35mRP\x1b[0m: Sound is -> \x1b[4m\x1b[37mSurround Sound\x1b[0m");
			}
		}
	});

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

	this.shield.status((status) => {
		this.shield.is_sleep = !status;
		if(status) console.log("\x1b[32mNS\x1b[0m: NVIDIA Shield -> \x1b[1mWake\x1b[0m");
		else console.log("\x1b[32mNS\x1b[0m: NVIDIA Shield -> \x1b[2mSleep\x1b[0m");
	});

	this.shield.on('currentappchange', (currentapp) => {
		if(this.lg == null) this.lg = { appId: "" };

		// If shield and tv are sleep while current app change, wake up everything
		if (this.lg.appId == "") {
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

		console.log(`\x1b[32mNS\x1b[0m: Shield active app -> \x1b[4m\x1b[37m${currentapp}\x1b[0m`);
	});

	this.shield.on('currentmediaappchange', (currentapp) => {
		this.current_media_app = currentapp;

		// If current app change, trigger RM Plus event, to change sound mode in receiver
		this.rmplus.checkData();

		console.log(`\x1b[32mNS\x1b[0m: Shield active media app -> \x1b[4m\x1b[37m${this.current_media_app}\x1b[0m`);
	});

	this.shield.on('awake', () => {
		this.shield.is_sleep = false;
		if(this.lg == null) this.lg = { appId: "" };

		// Need to have delay
		setTimeout(() => {
			// Wake up tv and then the reciever automatically
			if(this.lg.appId == "") this.rmplus.sendCode("tvpower");

			// Set input to HDMI1
			lgtv.request('ssap://system.launcher/launch', {id: this.shield.hdmi});
		}, 1000);

		console.log("\x1b[32mNS\x1b[0m: NVIDIA Shield -> \x1b[1mWake\x1b[0m");
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
});
// At the beginning loop until all devices are connected
let devicecheck = setInterval(() => {
	if (devices.lg != null && devices.mp1 != null && devices.rmplus != null && devices.shield != null) {
		devices.emit('mostready');
		devices.emit('ready');
		clearInterval(devicecheck);
	} else if (devices.mp1 != null && devices.rmplus != null && devices.shield != null) {
		this.force_emit = true;
		devices.emit('mostready');
		clearInterval(devicecheck);
	}
}, 1000);