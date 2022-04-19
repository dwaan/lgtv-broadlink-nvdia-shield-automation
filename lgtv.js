'use strict';

const { isUndefined } = require('util');

const timestamp = true;

let
	fs = require('fs'),
	path = require('path'),
	EventEmitter = require('events'),

	// Axios
	axios = require('axios').default,

	// LG TV
	lgtvId = {
		ip: `192.168.1.105`,
		mac: `a8:23:fe:ee:92:1c`
	},
	lgtv = require('lgtv2')({
		url: `ws://${lgtvId.ip}:3000`
	}),

	// NVIDIA Shield
	nvidiaShieldAdb = require('nodejs-adb-wrapper'),
	shield = new nvidiaShieldAdb('192.168.1.108', {
		interval: 2500,
		timeout: 2500
	}),

	// Broadlink MP1 and  RM Plus
	broadlink = require('broadlinkjs-dw'),
	broadlinks = new broadlink(),

	// NVIDIA Shield
	powerStateWithPing = require('nodejs-ping-wrapper'),
	nswitch = new powerStateWithPing('192.168.1.106'),

	// Wheater Report
	enableWeatherReport = false,

	// Costume vars
	devices = {}
;

let app_stereo = [
	"com.google.android.apps.mediashell",
	"com.ionitech.airscreen",
	"com.waxrain.airplaydmr3",
	"com.cloudmosa.puffinTV",
	"com.android.chrome",
	"com.nickonline.android.nickapp",
	"com.nvidia.bbciplayer",
	"com.google.android.youtube.tv",
	"com.turner.cnvideoapp",
	"com.webos.app.livetv",
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

	return `${year}-${month}-${day} \x1b[2m${hour}:${min}:${sec}\x1b[0m`;
}

const ID = `${timestamp ? getDateTime() + " - " : ""}🕹  `;


function delayedRun(id, callback, timeout) {
	if(id) clearTimeout(id);
	id = setTimeout(() => {
		callback();
		clearTimeout(id);
	}, timeout);
}



// Make some object for all devices
devices.emitter = new EventEmitter();
devices.on = devices.emitter.on;
devices.emit = devices.emitter.emit;
devices.lg = undefined;
devices.shield = undefined;
devices.mp1 = undefined;
devices.rmplus = undefined;
devices.rmmini3 = undefined;
devices.nswitch = undefined;


console.log(`\n${ID}\x1b[4mStarting...\x1b[0m`);


// Connect to Nintendo Switch
nswitch.hdmi = "com.webos.app.hdmi2";
nswitch.on('connected', () => {
	devices.nswitch = nswitch;
	console.log(`${ID}\x1b[33mNintendo Switch\x1b[0m: \x1b[1m🔌 Connected\x1b[0m`);
});
nswitch.connect().then(() => {
	// Nintendo Switch
	devices.nswitch.status(status => {
		if(status) devices.nswitch.emit('awake');
		else devices.nswitch.emit('sleep');
	});

	devices.nswitch.on('awake', () => {
		if(!devices.rmplus) return;
		if(!devices.lg) devices.lg = { appId: "" };

		// Wake up tv
		if(devices.lg.appId == "") devices.rmplus.sendCode("tvpower");

		// Switch to Pioneer input
		delayedRun(devices.nswitch.timer, () => {
			lgtv.request('ssap://system.launcher/launch', { id: devices.nswitch.hdmi });
			clearTimeout(devices.nswitch.timeout);
		}, 1000);

		console.log(`${ID}\x1b[33mNintendo Switch\x1b[0m: Status -> \x1b[1m🌞 Wake\x1b[0m`);
	});

	devices.nswitch.on('sleep', () => {
		if(!devices.lg) return;

		// If Switch is sleeping while in input HDMI2 then turn on NVIDIA Shield
		if(devices.lg.appId == devices.nswitch.hdmi) {
			devices.current_media_app = "";
			lgtv.request('ssap://system.launcher/launch', { id: devices.shield.hdmi });
		}

		console.log(`${ID}\x1b[33mNintendo Switch\x1b[0m: Status -> \x1b[2m🛌 Sleep\x1b[0m`);
	});
}).catch((error) => {
	console.log("Can't connect");
});

// Connect to NVIDIA Shield
shield.hdmi = "com.webos.app.hdmi1";
shield.update().then(() => {
	devices.shield = shield;
	console.log(`${ID}\x1b[32mNvidia Shield\x1b[0m: \x1b[1m🔌 Connected\x1b[0m`);
});

// Connect to Broadlink RM Plus, for Reciever IR blaster
// Connect to Broadlink MP1, for Reciever Power
broadlinks.on("deviceReady", (dev) => {
	if(dev.type == "_RMMini_") {
		devices.rmmini3 = dev;

		console.log(`${ID}\x1b[35mBroadlink RM Mini 3 C\x1b[0m: \x1b[1m🔌 Connected\x1b[0m`);

		// Listening to IR command in RM Mini 3

		devices.rmmini3.on("rawData", (data) => {
		    console.log(`${ID}\x1b[35mBroadlink RM Mini 3 C\x1b[0m: \x1b[1m📡 Received\x1b[0m -> ${data.toString("hex")}`);
		    devices.rmmini3.enterLearning();
		});

		devices.rmmini3.intervalCheck = setInterval(() =>{
		    devices.rmmini3.checkData();
		}, 250);
		devices.rmmini3.intervalLearning = setInterval(() =>{
		    devices.rmmini3.enterLearning();
		}, 10000);

		devices.rmmini3.enterLearning();
		console.log(`${ID}\x1b[35mBroadlink RM Mini 3 C\x1b[0m: \x1b[1m📡 Listening IR Code\x1b[0m`);
	} else if(dev.type == "RMPro") {
		function bufferFile(relPath) {
			return fs.readFileSync(path.join(__dirname, relPath));
		}

		devices.rmplus = dev;
		devices.rmplus.sendCode = function() {
			var argv = arguments,
				i= 0,
				loop = setInterval(() => {
					dev.sendData(bufferFile("code/" + argv[i++] + ".bin"));
					if(i >= argv.length) clearInterval(loop);
				}, 500);
		}

		console.log(`${ID}\x1b[35mBroadlink RM Pro+\x1b[0m: \x1b[1m🔌 Connected\x1b[0m`);
	} else if(dev.type == "MP1") {
		if(dev.host.address == "192.168.1.102") {
			devices.mp1 = dev;
			devices.mp1.is_sleep = true;
			console.log(`${ID}\x1b[33mBroadlink MP1\x1b[0m: \x1b[1m🔌 Connected\x1b[0m`);
		}
	}
});
broadlinks.discover();

// Connect to LG TV
lgtv.on('connect', () => {
	let emitter = new EventEmitter();

	devices.lg = {};
	devices.lg.appId = "";
	devices.lg.on = emitter.on;
	devices.lg.emit = emitter.emit;

	if(devices.forceEmit) {
		devices.forceEmit = false;
		devices.emit('ready');
	}

	console.log(`${ID}\x1b[36mLG TV\x1b[0m: \x1b[1m🔌 Connected\x1b[0m`);
});
// Prompt for security code
lgtv.on('prompt', () => {
	console.log(`${ID}\x1b[36mLG TV\x1b[0m: Please authorize on LG TV`);
});
lgtv.on('close', () => {
	console.log(`${ID}\x1b[36mLG TV\x1b[0m: Status -> 🚪 Close`);
});
lgtv.on('error', (err) => {
	if(err) console.log(`${ID}\x1b[36mLG TV\x1b[0m: TV -> 🚫 No Response`);
});
lgtv.toast = (message) => {
	try {
		lgtv.request('ssap://com.webos.service.apiadapter/system_notifications/createToast', { message: message });
	} catch (error) {
		console.log(`${ID}\x1b[4m${message}\x1b[0m`)
	}
}
// Set audio output to HDMI-ARC
lgtv.setAudioToHDMIARC = function() {
	if(!devices.lg) return;
	if(devices.lg.appId == "") return;

	if(devices.lg.soundOutput != 'external_arc') {
		lgtv.request('ssap://com.webos.service.apiadapter/audio/changeSoundOutput', {
			output: 'external_arc'
		}, (err, res) => {
			if(!res || err || res.errorCode || !res.returnValue) {
				console.log(`${ID}\x1b[36mLG TV\x1b[0m: Sound Output -> 🔈 Error while changing sound output`);
			}
		});
	}
}


// When all devices is on
devices.on('ready', function() {
	lgtv.toast("Starting 📺 Automation");

	lgtv.subscribe('ssap://com.webos.service.tvpower/power/getPowerState', (err, res) => {
	    if(!res || err || res.errorCode) {
	        console.log(`${ID}\x1b[36mLG TV\x1b[0m: TV -> 🚫 Error while getting power status | ${err} | ${res}`);
			return;
	    }

		let statusState = (res && res.state ? res.state : undefined);
		let statusProcessing = (res && res.processing ? res.processing : undefined);
		let statusPowerOnReason = (res && res.powerOnReason ? res.powerOnReason : undefined);
		let statuses = "";

		if(statusState) {
			statuses += 'State: ' + statusState;
		}
		if(statusProcessing) {
			if(statuses != "") statuses += ", ";
			statuses += 'Processing: ' + statusProcessing;
		}
		if(statusPowerOnReason) {
			if(statuses != "") statuses += ", ";
			statuses += 'Power on reason: ' + statusPowerOnReason;
		}

		// Turn off Receiver and Shield when TV turn to Standby mode
		if(statuses == "State: Active Standby") {
			this.shield.powerOff('KEYCODE_SLEEP');
			this.mp1.emit("receiveroff");
			this.forceEmit = true;
			if(this.lg != undefined) this.lg.appId = "";
			console.log(`${ID}\x1b[36mLG TV\x1b[0m: Status -> 💬 Standby`);
		}
	});

	lgtv.subscribe('ssap://com.webos.service.apiadapter/tv/getExternalInputList', (err, res) => {
		if(err) return;

		var appId = "";

		// Read active input
		res.devices.forEach(element => {
			if(element.connected && element.subCount > 0) {
				appId = element.appId;
			}
		});

		if(appId == this.shield.hdmi && this.lg.appId != this.shield.hdmi) return;

		// Switch to Active input
		if(appId != "" && appId != this.lg.appId && this.lg.appId.includes("hdmi")) {
			lgtv.request('ssap://system.launcher/launch', {id: appId});
			console.log(`${ID}\x1b[36mLG TV\x1b[0m: Input -> 📺 ${appId}`);
		}

		// Set reciever to Switch input
		if(this.nswitch) {
			if(appId == this.nswitch.hdmi) this.rmplus.sendCode("inputswitch");
		} else this.rmplus.sendCode("inputtv");
	});

	lgtv.subscribe('ssap://com.webos.applicationManager/getForegroundAppInfo', (err, res) => {
		if(err) return;

		if(res.appId == "") {
			console.log(`${ID}\x1b[36mLG TV\x1b[0m: TV -> \x1b[2m🛌 Sleep\x1b[0m`);
			return;
		} else {
			// Set current appid
			this.lg.appId = res.appId;

			// Turn on reciever
			this.mp1.emit("receiveron");

			// Set audio output to HDMI-ARC
			lgtv.setAudioToHDMIARC();

			this.shield.onPowerOn = true;

			console.log(`${ID}\x1b[36mLG TV\x1b[0m: TV -> \x1b[1m🌞 Wake\x1b[0m`);
			console.log(`${ID}\x1b[36mLG TV\x1b[0m: Current App -> 📺 \x1b[4m\x1b[37m${res.appId}\x1b[0m`);
		}

		// Change sound mode in receiver
		if(this.lg.appId != this.shield.hdmi) {
			this.shield.powerOff('KEYCODE_SLEEP')
			this.current_media_app = this.lg.appId;
		} else {
			this.shield.powerOn('KEYCODE_WAKEUP').then(() => {
				this.shield.onPowerOn = false;
			});
		}

		// Switch reciever sound mode accordingly
		this.rmplus.emit("changevolume");
	});

	lgtv.subscribe('ssap://com.webos.service.apiadapter/audio/getSoundOutput', (err, res) => {
		if(!res || err || res.errorCode) {
			console.log(`${ID}\x1b[36mLG TV\x1b[0m: Sound Output -> 🔈 Error while getting current sound output | ${err} | ${res}`);
		} else if(this.lg.soundOutput != res.soundOutput) {
			if(this.lg.appId == "") return;

			this.lg.soundOutput = res.soundOutput;

			// Turn on/off receiver
			if(res.soundOutput == 'external_arc') this.mp1.emit("receiveron");

			console.log(`${ID}\x1b[36mLG TV\x1b[0m: Sound Output -> 🔈 ${res.soundOutput}`);
		}
	});
});


// When all devices except TV is on
devices.on('mostready', function() {
	// Pioner Reciever IR Command

	this.rmplus.on("changevolume", () => {
		delayedRun(this.rmplus.timer, () => {
			// Check LG TV and NVIDIA Shield Active app
			// Set reciever mode based on the stereo list
			if(app_stereo.includes(this.current_media_app)) {
				// Set reciever mode to extra-stereo
				if(this.rmplus.sound_mode != "stereo") {
					this.rmplus.sound_mode = "stereo";
					this.rmplus.sendCode("soundalc", "soundstereo");
					console.log(`${ID}\x1b[35mBroadlink\x1b[0m: Sound -> 🔈 Stereo`);
					lgtv.toast("🔊: Stereo");
				}
			} else if(this.lg.appId != "") {
				// Set reciever mode to auto surround sound for other
				if(this.rmplus.sound_mode != "soundauto") {
					this.rmplus.sound_mode = "soundauto";
					this.rmplus.sendCode("soundalc", "soundauto");
					console.log(`${ID}\x1b[35mBroadlink\x1b[0m: Sound -> 🔈 Auto Surround`);
					lgtv.toast("🔊: Auto Surround");
				}
			}
		}, 1500);
	});


	// Pioner Reciever Power

	this.mp1.on('receiveron', () => {
		delayedRun(this.mp1.timer, () => {
			if(this.mp1.is_sleep) {
				this.mp1.set_power(3,1);
				console.log(`${ID}\x1b[33mBroadlink MP\x1b[0m: Pioneer Receiver -> 🔌 \x1b[1mON\x1b[0m`);
			}
			this.mp1.is_sleep = false;
		}, 1000);
	});
	this.mp1.on('receiveroff', () => {
		delayedRun(this.mp1.timer, () => {
			if(!this.mp1.is_sleep) {
				this.mp1.set_power(3,0);
				console.log(`${ID}\x1b[33mBroadlink MP\x1b[0m: Pioneer Receiver -> 🔌 \x1b[2mOFF\x1b[0m`);
			}
			this.mp1.is_sleep = true;
		}, 5000);
	});

	// NVIDIA Switch

	this.shield.state().then(({ result, message }) => {
		this.shield.emit(result ? `awake` : `sleep`);
	}).catch(_ => { });

	this.shield.on('appChange', currentapp => {
		if(currentapp == "org.xbmc.kodi") lgtv.toast("Go to sleep 🐒");

		console.log(`${ID}\x1b[32mNvidia Shield\x1b[0m: Active App -> 📱 \x1b[4m\x1b[37m${currentapp}\x1b[0m`);
	});

	this.shield.on('playback', currentapp => {
		// If current media app change, trigger RM Plus event, to change sound mode in receiver
		this.current_media_app = currentapp;

		this.rmplus.emit("changevolume");

		console.log(`${ID}\x1b[32mNvidia Shield\x1b[0m: Active Media App -> 📱 \x1b[4m\x1b[37m${this.current_media_app}\x1b[0m`);
	});

	// When shield is awake
	this.shield.on('awake', () => {
		if(!this.lg) this.lg = { appId: "" };

		// Wake up tv, the reciever should automatically on also
		if(this.lg.appId == "") this.rmplus.sendCode("tvpower");

		// Delayed to make sure everything is on first
		delayedRun(this.lg.timer, () => {
			// Set input to HDMI1
			lgtv.request('ssap://system.launcher/launch', { id: this.shield.hdmi });
		}, 1000);

		console.log(`${ID}\x1b[32mNvidia Shield\x1b[0m: Status -> \x1b[1m🌞 Wake\x1b[0m`);
	});

	this.shield.on('sleep', () => {
		if(!this.lg || this.shield.onPowerOn) return;

		// If Shield is sleeping while in input HDMI1 then turn off TV
		if(this.lg.appId == this.shield.hdmi) {
			this.current_media_app = "";
			lgtv.request('ssap://system/turnOff');
		}

		console.log(`${ID}\x1b[32mNvidia Shield\x1b[0m: Status -> \x1b[2m🛌 Sleep\x1b[0m`);
	});
});



// At the beginning loop until all devices are connected
devices.mostReady = false;
let deviceCheck = setInterval(() => {
	if(
		!isUndefined(devices.lg) &&
		// !isUndefined(devices.nswitch) &&
		!isUndefined(devices.mp1) &&
		!isUndefined(devices.rmplus) &&
		!isUndefined(devices.shield)
	) {
		if(!devices.mostReady) devices.emit('mostready');
		devices.emit('ready');
		clearInterval(deviceCheck);
	} else if(
		// !isUndefined(devices.nswitch) &&
		!isUndefined(devices.mp1) &&
		!isUndefined(devices.rmplus) &&
		!isUndefined(devices.shield)
	) {
		devices.forceEmit = true;
		devices.mostReady = true;
		devices.emit('mostready');
		clearInterval(deviceCheck);
	}
}, 500);


// openweathermap.org API to get current temperature
function weatherReport() {
	let apiKey = '40dc2517a33b8ddb7aac60c64a7b3f80';
	let city = 'tel-aviv';
	let url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;

	// Every 5 minutes the script will write temperature to temperature.txt
	function updateTemperature() {
		var temperature = "0";
		var humidity = "0";

		axios.get(url)
			.then(function (response) {
				const weather = response.data;
				if(weather.main) {
					temperature = weather.main.temp + "";
					humidity = weather.main.humidity + "";
					console.log(`${ID}\x1b[37mWeather\x1b[0m: ${weather.weather[0].main} ${weather.weather[0].id} ${weather.weather[0].description}`);
				} else console.log(`${ID}\x1b[37mWeather\x1b[0m: ${weather.message}`);
			})
			.catch(function () {
				console.log(25);
			})
			.then(function () {
				fs.writeFile( "temperature.txt", temperature, function(err) {
					if(err) return false;
				});
				fs.writeFile( "humidity.txt", humidity, function(err) {
					if(err) return false;
				});
			});
	}
	updateTemperature();
	setInterval(() => {
		updateTemperature()
	}, 5 * 60 * 1000);
}
if(enableWeatherReport) weatherReport();