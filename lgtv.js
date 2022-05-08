'use strict';

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
	mp1 = false,
	rmpro = false,
	rmmini3 = false,

	// Nintendo Switch
	powerStateWithPing = require('nodejs-ping-wrapper'),
	nswitch = new powerStateWithPing('192.168.1.106', 22),

	// Wheater Report
	enableWeatherReport = false,

	// Costume vars
	currentMediaApp = ""
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

	var min = date.getMinutes();
	min = (min < 10 ? "0" : "") + min;
	``
	var sec = date.getSeconds();
	sec = (sec < 10 ? "0" : "") + sec;

	var year = date.getFullYear();

	var month = date.getMonth() + 1;
	month = (month < 10 ? "0" : "") + month;

	var day = date.getDate();
	day = (day < 10 ? "0" : "") + day;

	return `${year}-${month}-${day} \x1b[2m${hour}:${min}:${sec}\x1b[0m`;
}

function ID() {
	return `${timestamp ? getDateTime() + " - " : ""}🕹  `;
}


function delayedRun(id, callback, timeout) {
	if (id) clearTimeout(id);
	id = setTimeout(() => {
		callback();
		clearTimeout(id);
	}, timeout);
}


console.log(`\n${ID()}\x1b[4mStarting...\x1b[0m`);


// Connect to Nintendo Switch
nswitch.hdmi = "com.webos.app.hdmi2";
nswitch.on('connected', () => {
	console.log(`${ID()}\x1b[33mNintendo Switch\x1b[0m: \x1b[1m🔌 Connected\x1b[0m`);
});
nswitch.connect().catch(_ => {
	console.log("Can't connect");
});
// When wake
nswitch.on('awake', () => {
	// Wake up tv and set HDMI
	lgtv.turnOn();
	lgtv.setHDMI(nswitch.hdmi);

	console.log(`${ID()}\x1b[33mNintendo Switch\x1b[0m: Status -> \x1b[1m🌞 Wake\x1b[0m`);
});
// When sleep
nswitch.on('sleep', () => {
	// If Switch is sleeping while in input HDMI2 then turn on NVIDIA Shield
	if (lgtv.appId == nswitch.hdmi) {
		currentMediaApp = "";
		lgtv.request('ssap://system.launcher/launch', { id: shield.hdmi });
	}

	console.log(`${ID()}\x1b[33mNintendo Switch\x1b[0m: Status -> \x1b[2m🛌 Sleep\x1b[0m`);
});

// Connect to NVIDIA Shield
shield.hdmi = "com.webos.app.hdmi1";
shield.update().then(() => {
	console.log(`${ID()}\x1b[32mNvidia Shield\x1b[0m: \x1b[1m🔌 Connected\x1b[0m`);
}).catch(e => console.log(`${ID()}\x1b[32mNvidia Shield\x1b[0m: Error`, e));
// App change
shield.on('appChange', currentapp => {
	if (currentapp == "org.xbmc.kodi") lgtv.toast("Go to sleep 🐒");

	console.log(`${ID()}\x1b[32mNvidia Shield\x1b[0m: Active App -> 📱 \x1b[4m\x1b[37m${currentapp}\x1b[0m`);
});
// Playback change
shield.on('playback', currentapp => {
	// If current media app change, trigger RM Plus event, to change sound mode in receiver
	currentMediaApp = currentapp;

	broadlinks.changeAudioType();

	console.log(`${ID()}\x1b[32mNvidia Shield\x1b[0m: Active Media App -> 📱 \x1b[4m\x1b[37m${currentMediaApp}\x1b[0m`);
});
// When shield is awake
shield.on('awake', () => {
	// Wake up tv and set the HDMO
	lgtv.turnOn();
	lgtv.setHDMI(shield.hdmi);

	console.log(`${ID()}\x1b[32mNvidia Shield\x1b[0m: Status -> \x1b[1m🌞 Wake\x1b[0m`);
});
// When shield is  sleep
shield.on('sleep', () => {
	if (shield.lgtvDoesntEffectPowerState) return;

	// If Shield is sleeping while in input HDMI1 then turn off TV
	if (lgtv.appId == shield.hdmi) {
		currentMediaApp = "";
		lgtv.turnOff();
	}

	console.log(`${ID()}\x1b[32mNvidia Shield\x1b[0m: Status -> \x1b[2m🛌 Sleep\x1b[0m`);
});

// Connect to Broadlink RM Plus, for Reciever IR blaster
// Connect to Broadlink MP1, for Reciever Power
broadlinks.on("deviceReady", (dev) => {
	if (dev.type == "_RMMini_") {
		rmmini3 = dev;

		console.log(`${ID()}\x1b[35mBroadlink RM Mini 3 C\x1b[0m: \x1b[1m🔌 Connected\x1b[0m`);

		// Listening to IR command in RM Mini 3

		rmmini3.on("rawData", (data) => {
			console.log(`${ID()}\x1b[35mBroadlink RM Mini 3 C\x1b[0m: \x1b[1m📡 Received\x1b[0m -> ${data.toString("hex")}`);
			rmmini3.enterLearning();
		});

		rmmini3.intervalCheck = setInterval(() => {
			rmmini3.checkData();
		}, 250);
		rmmini3.intervalLearning = setInterval(() => {
			rmmini3.enterLearning();
		}, 10000);

		rmmini3.enterLearning();
		console.log(`${ID()}\x1b[35mBroadlink RM Mini 3 C\x1b[0m: \x1b[1m📡 Listening IR Code\x1b[0m`);
	} else if (dev.type == "RMPro") {
		function bufferFile(relPath) {
			return fs.readFileSync(path.join(__dirname, relPath));
		}

		rmpro = dev;
		rmpro.sendCode = function (args) {
			var i = 0,
				loop = setInterval(() => {
					try {
						dev.sendData(bufferFile("code/" + args[i++] + ".bin"));
						if (i >= args.length) clearInterval(loop);
					} catch (e) {
						console.log(e);
					}
				}, 500);
		}

		// Pioner Reciever IR Command
		rmpro.on("changeaudiotype", () => {
			delayedRun(rmpro.timer, () => {
				// Check LG TV and NVIDIA Shield Active app
				// Set reciever mode based on the stereo list
				if (app_stereo.includes(this.current_media_app)) {
					// Set reciever mode to extra-stereo
					if (rmpro.sound_mode != "stereo") {
						rmpro.sound_mode = "stereo";
						rmpro.sendCode(["soundalc", "soundstereo"]);
						console.log(`${ID()}\x1b[35mBroadlink\x1b[0m: Sound -> 🔈 Stereo`);
						lgtv.toast("🔊: Stereo");
					}
				} else if (lgtv.appId != "") {
					// Set reciever mode to auto surround sound for other
					if (rmpro.sound_mode != "soundauto") {
						rmpro.sound_mode = "soundauto";
						rmpro.sendCode(["soundalc", "soundauto"]);
						console.log(`${ID()}\x1b[35mBroadlink\x1b[0m: Sound -> 🔈 Auto Surround`);
						lgtv.toast("🔊: Auto Surround");
					}
				}
			}, 1500);
		});

		console.log(`${ID()}\x1b[35mBroadlink RM Pro\x1b[0m: \x1b[1m🔌 Connected\x1b[0m`);
	} else if (dev.type == "MP1" && dev.host.address == "192.168.1.102") {
		mp1 = dev;
		mp1.isSleep = true;

		// Pioner Reciever Power
		mp1.on('receiveron', () => {
			delayedRun(mp1.timer, () => {
				if (mp1.isSleep) {
					mp1.set_power(3, 1);
					console.log(`${ID()}\x1b[33mBroadlink MP\x1b[0m: Pioneer Receiver -> 🔌 \x1b[1mON\x1b[0m`);
				}
				mp1.isSleep = false;
			}, 1000);
		});
		mp1.on('receiveroff', () => {
			delayedRun(mp1.timer, () => {
				if (!mp1.isSleep) {
					mp1.set_power(3, 0);
					console.log(`${ID()}\x1b[33mBroadlink MP\x1b[0m: Pioneer Receiver -> 🔌 \x1b[2mOFF\x1b[0m`);
				}
				mp1.isSleep = true;
			}, 5000);
		});

		console.log(`${ID()}\x1b[33mBroadlink MP1\x1b[0m: \x1b[1m🔌 Connected\x1b[0m`);
	}
});
broadlink.power = (state = true) => {
	// Loop until connected
	let loop = setInterval(() => {
		if (mp1) {
			clearInterval(loop);
			if (state) mp1.emit("receiveron");
			else mp1.emit("receiveroff");
		}
	}, 1000);
}
broadlinks.sendCode = (args) => {
	if (typeof args != 'object') return;
	// Loop until connected
	let loop = setInterval(() => {
		if (rmpro) {
			clearInterval(loop);
			rmpro.sendCode(args);
		}
	}, 1000);
}
broadlinks.changeAudioType = () => {
	// Loop until connected
	let loop = setInterval(() => {
		if (rmpro) {
			clearInterval(loop);
			rmpro.emit("changeaudiotype");
		}
	}, 1000);
}
broadlinks.discover();

// Connect to LG TV
lgtv.appId = "";
lgtv.soundOutput = "";
// On connect
lgtv.on('connect', () => {
	lgtv.toast("Starting 📺 Automation");

	lgtv.subscribe('ssap://com.webos.service.tvpower/power/getPowerState', (err, res) => {
		if (!res || err || res.errorCode) {
			console.log(`${ID()}\x1b[36mLG TV\x1b[0m: TV -> 🚫 Error while getting power status | ${err} | ${res}`);
			return;
		}

		let statusState = (res && res.state ? res.state : undefined);
		let statusProcessing = (res && res.processing ? res.processing : undefined);
		let statusPowerOnReason = (res && res.powerOnReason ? res.powerOnReason : undefined);
		let statuses = "";

		if (statusState) {
			statuses += 'State: ' + statusState;
		}
		if (statusProcessing) {
			if (statuses != "") statuses += ", ";
			statuses += 'Processing: ' + statusProcessing;
		}
		if (statusPowerOnReason) {
			if (statuses != "") statuses += ", ";
			statuses += 'Power on reason: ' + statusPowerOnReason;
		}

		// Turn off Receiver and Shield when TV turn to Standby mode
		if (statuses == "State: Active Standby") {
			shield.powerOff('KEYCODE_SLEEP');
			broadlink.power(false);
			if (lgtv != undefined) lgtv.appId = "";
			console.log(`${ID()}\x1b[36mLG TV\x1b[0m: Status -> 💬 Standby`);
		}
	});

	lgtv.subscribe('ssap://com.webos.service.apiadapter/tv/getExternalInputList', (err, res) => {
		if (err) return;

		var appId = "";

		// Read active input
		res.devices.forEach(element => {
			if (element.connected && element.subCount > 0) {
				appId = element.appId;
			}
		});

		if (appId == shield.hdmi && lgtv.appId == shield.hdmi) return;

		// Switch to Active input
		if (appId != "" && appId != lgtv.appId && lgtv.appId.includes("hdmi")) {
			lgtv.request('ssap://system.launcher/launch', { id: appId });
			console.log(`${ID()}\x1b[36mLG TV\x1b[0m: Input -> 📺 ${appId}`);
		}

		// Set reciever to Switch input
		if (appId == nswitch.hdmi) broadlinks.sendCode(["inputswitch"]);
		else broadlinks.sendCode(["inputtv"]);
	});

	lgtv.subscribe('ssap://com.webos.applicationManager/getForegroundAppInfo', (err, res) => {
		if (err) return;

		if (res.appId == "") {
			console.log(`${ID()}\x1b[36mLG TV\x1b[0m: TV -> \x1b[2m🛌 Sleep\x1b[0m`);
			return;
		}

		// Set current appid
		lgtv.appId = res.appId;
		shield.lgtvDoesntEffectPowerState = true;

		// Turn on reciever
		broadlink.power();

		// Set audio output to HDMI-ARC
		lgtv.setAudioToHDMIARC();

		console.log(`${ID()}\x1b[36mLG TV\x1b[0m: TV -> \x1b[1m🌞 Wake\x1b[0m`);
		console.log(`${ID()}\x1b[36mLG TV\x1b[0m: Current App -> 📺 \x1b[4m\x1b[37m${res.appId}\x1b[0m`);

		// Change sound mode in receiver
		if (lgtv.appId != shield.hdmi) {
			shield.powerOff('KEYCODE_SLEEP')
			this.current_media_app = lgtv.appId;
		} else {
			shield.powerOn('KEYCODE_WAKEUP').then(() => {
				shield.lgtvDoesntEffectPowerState = false;
			});
		}

		// Switch reciever sound mode accordingly
		broadlinks.changeAudioType();
	});

	lgtv.subscribe('ssap://com.webos.service.apiadapter/audio/getSoundOutput', (err, res) => {
		if (!res || err || res.errorCode) {
			console.log(`${ID()}\x1b[36mLG TV\x1b[0m: Sound Output -> 🔈 Error while getting current sound output | ${err} | ${res}`);
		} else if (lgtv.soundOutput != res.soundOutput) {
			if (lgtv.appId == "") return;

			lgtv.soundOutput = res.soundOutput;

			// Turn on/off receiver
			if (res.soundOutput == 'external_arc') broadlink.power();

			console.log(`${ID()}\x1b[36mLG TV\x1b[0m: Sound Output -> 🔈 ${res.soundOutput}`);
		}
	});

	console.log(`${ID()}\x1b[36mLG TV\x1b[0m: \x1b[1m🔌 Connected\x1b[0m`);
});
// Prompt for security code
lgtv.on('prompt', () => {
	console.log(`${ID()}\x1b[36mLG TV\x1b[0m: Please authorize on LG TV`);
});
lgtv.on('close', () => {
	console.log(`${ID()}\x1b[36mLG TV\x1b[0m: Status -> 🚪 Close`);
});
lgtv.on('error', (err) => {
	if (err) console.log(`${ID()}\x1b[36mLG TV\x1b[0m: TV -> 🚫 No Response`);
});
lgtv.toast = (message) => {
	try {
		lgtv.request('ssap://com.webos.service.apiadapter/system_notifications/createToast', { message: message });
	} catch (error) {
		console.log(`${ID()}\x1b[4m${message}\x1b[0m`)
	}
}
// Set audio output to HDMI-ARC
lgtv.setAudioToHDMIARC = function () {
	if (lgtv.appId == "") return;

	if (lgtv.soundOutput != 'external_arc') {
		lgtv.request('ssap://com.webos.service.apiadapter/audio/changeSoundOutput', {
			output: 'external_arc'
		}, (err, res) => {
			if (!res || err || res.errorCode || !res.returnValue) {
				console.log(`${ID()}\x1b[36mLG TV\x1b[0m: Sound Output -> 🔈 Error while changing sound output`);
			}
		});
	}
}
// Turn on and off TV
lgtv.turnOn = function () {
	if (lgtv.appId != "") return;

	console.log(`${ID()}\x1b[36mLG TV\x1b[0m: Turning On`);

	if (lgtv.powerInterval) clearInterval(lgtv.powerInterval);
	lgtv.powerInterval = setInterval(() => {
		if (lgtv.appId == "") broadlinks.sendCode(["tvpower"]);
		else clearInterval(lgtv.powerInterval);
	}, 1000);
}
lgtv.turnOff = function () {
	if (lgtv.appId == "") return;

	console.log(`${ID()}\x1b[36mLG TV\x1b[0m: Turning Off`);

	if (lgtv.powerInterval) clearInterval(lgtv.powerInterval);
	lgtv.powerInterval = setInterval(() => {
		if (lgtv.request) {
			lgtv.request('ssap://system/turnOff');
			clearInterval(lgtv.powerInterval);
		}
	}, 1000);
}
// Set HDMI
lgtv.setHDMI = function (hdmi) {
	if (lgtv.hdmiInterval) clearInterval(lgtv.hdmiInterval);
	lgtv.hdmiInterval = setInterval(() => {
		if (hdmi == lgtv.appId) clearInterval(lgtv.hdmiInterval);
		else if (lgtv.request) lgtv.request('ssap://system.launcher/launch', { id: hdmi });
	}, 1000);
}

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
				if (weather.main) {
					temperature = weather.main.temp + "";
					humidity = weather.main.humidity + "";
					console.log(`${ID()}\x1b[37mWeather\x1b[0m: ${weather.weather[0].main} ${weather.weather[0].id} ${weather.weather[0].description}`);
				} else console.log(`${ID()}\x1b[37mWeather\x1b[0m: ${weather.message}`);
			})
			.catch(function () {
				console.log(25);
			})
			.then(function () {
				fs.writeFile("temperature.txt", temperature, function (err) {
					if (err) return false;
				});
				fs.writeFile("humidity.txt", humidity, function (err) {
					if (err) return false;
				});
			});
	}
	updateTemperature();
	setInterval(() => {
		updateTemperature()
	}, 5 * 60 * 1000);
}
if (enableWeatherReport) weatherReport();
