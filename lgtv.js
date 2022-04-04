'use strict';

const ID = "🕹 - ";
const timestamp = false;

let
	fs = require('fs'),
	path = require('path'),
	EventEmitter = require('events'),

	// Axios
	axios = require('axios').default,

	// LG TV
	lgtv = require('lgtv2')({
		url: 'ws://192.168.1.105:3000'
	}),

	// NVIDIA Shield
	nvidiaShieldAdb = require('nvidia-shield-adb'),
	shield = new nvidiaShieldAdb('192.168.1.108'),

	// Broadlink MP1 and  RM Plus
	broadlink = require('broadlinkjs'),
	broadlinks = new broadlink(),

	// NVIDIA Shield
	powerStateWithPing = require('power-state-with-ping'),
	nswitch = new powerStateWithPing('192.168.1.106', 14000),

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

	if(timestamp) return year + ":" + month + ":" + day + ":" + hour + ":" + min + ":" + sec;
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
devices.rmmini3 = null;
devices.nswitch = null;


console.log(`\n${ID}\x1b[4mStarting...\x1b[0m`);


// Connect to Nintendo Switch
nswitch.debug = false;
nswitch.hdmi = "com.webos.app.hdmi2";
nswitch.on('ready', function() {
	devices.nswitch = this;
	console.log(`${ID}\x1b[33mNintendo Switch\x1b[0m: \x1b[1m🔌 Connected\x1b[0m ${getDateTime()}`);
});
nswitch.connect(false);

// Connect to NVIDIA Shield
shield.debug = false;
shield.hdmi = "com.webos.app.hdmi1";
shield.on('ready', function() {
	devices.shield = this;
	console.log(`${ID}\x1b[32mNvidia Shield\x1b[0m: \x1b[1m🔌 Connected\x1b[0m ${getDateTime()}`);
});
shield.connect(false);

// Connect to Broadlink RM Plus, for Reciever IR blaster
// Connect to Broadlink MP1, for Reciever Power
broadlinks.on("deviceReady", (dev) => {
	if(dev.type == "RM3") {
		devices.rmmini3 = dev;

		console.log(`${ID}\x1b[35mBroadlink RM Mini 3 C\x1b[0m: \x1b[1m🔌 Connected\x1b[0m ${getDateTime()}`);

		// Listening to IR command in RM Mini 3

		this.rmmini3.on("rawData", (data) => {
		    console.log(`${ID}\x1b[35mBroadlink RM Mini 3 C\x1b[0m: \x1b[1m📡 Received\x1b[0m -> ${data.toString("hex")}`);
		    this.rmmini3.enterLearning();
		});

		this.rmmini3.intervalCheck = setInterval(() =>{
		    this.rmmini3.checkData();
		}, 250);
		this.rmmini3.intervalLearning = setInterval(() =>{
		    this.rmmini3.enterLearning();
		}, 10000);

		this.rmmini3.enterLearning();
		console.log(`${ID}\x1b[35mBroadlink RM Mini 3 C\x1b[0m: \x1b[1m📡 Listening IR Code\x1b[0m ${getDateTime()}`);
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

		console.log(`${ID}\x1b[35mBroadlink RM Pro+\x1b[0m: \x1b[1m🔌 Connected\x1b[0m ${getDateTime()}`);
	} else if(dev.type == "MP1") {
		if(dev.host.address == "192.168.1.102") {
			devices.mp1 = dev;
			console.log(`${ID}\x1b[33mBroadlink MP1\x1b[0m: \x1b[1m🔌 Connected\x1b[0m ${getDateTime()}`);
		}
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

	// Set audio output to HDMI-ARC
	devices.lg.setAudioToHDMIARC = function() {
		if(this.soundOutput != 'external_arc') {
			lgtv.request('ssap://com.webos.service.apiadapter/audio/changeSoundOutput', {
				output: 'external_arc'
			}, (err, res) => {
				if(!res || err || res.errorCode || !res.returnValue) {
					console.log(`${ID}\x1b[36mLG TV\x1b[0m: Sound Output -> 🔈 Error while changing sound output`);
				}
			});
		}
	}

	if(this.force_emit) {
		this.force_emit = false;
		devices.emit('ready');
	}

	console.log(`${ID}\x1b[36mLG TV\x1b[0m: \x1b[1m🔌 Connected\x1b[0m ${getDateTime()}`);
});
// Prompt for security code
lgtv.on('prompt', () => {
	console.log(`${ID}\x1b[36mLG TV\x1b[0m: Please authorize on LG TV`);
});
lgtv.on('close', () => {
	console.log(`${ID}\x1b[36mLG TV\x1b[0m: Status -> 🚪 Close ${getDateTime()}`);
});
lgtv.on('error', (err) => {
	this.force_emit = true;
	console.log(`${ID}\x1b[36mLG TV\x1b[0m: TV -> 🚫 No Response`);
});


// When all devices is on
devices.on('ready', function() {
	console.log(`${ID}\x1b[4mAll devices are ready ...\x1b[0m`);

	lgtv.request('ssap://system.notifications/createToast', { message: "TV Automation: On" });

	lgtv.subscribe('ssap://com.webos.service.tvpower/power/getPowerState', (err, res) => {
	    if(!res || err || res.errorCode) {
	        console.log(`${ID}\x1b[36mLG TV\x1b[0m: TV -> 🚫 Error while getting power status | ${err} | ${res}`);
	    } else {
	        let statusState = (res && res.state ? res.state : null);
	        let statusProcessing = (res && res.processing ? res.processing : null);
	        let statusPowerOnReason = (res && res.powerOnReason ? res.powerOnReason : null);
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

			if(statuses == "State: Active Standby") {
				// turn off receiver and shield
				this.mp1.emit("receiveroff");
				this.shield.sleep();

				this.force_emit = true;
				if(this.lg != null) this.lg.appId = "";
			}

			console.log(`${ID}\x1b[36mLG TV\x1b[0m: Status -> 💬 ${statuses}`);
	    }
	});

	lgtv.subscribe('ssap://com.webos.applicationManager/getForegroundAppInfo', (err, res) => {
		if(err) return;
		
		if(res.appId == "") {
			console.log(`${ID}\x1b[36mLG TV\x1b[0m: TV -> \x1b[2m🛌 Sleep\x1b[0m`);
		} else {
			if(this.lg.appId == "") {
				// Turn on reciever
				this.mp1.emit("receiveron");

				// Set audio output to HDMI-ARC
				this.lg.setAudioToHDMIARC();

				console.log(`${ID}\x1b[36mLG TV\x1b[0m: TV -> \x1b[1m🌞 Wake\x1b[0m`);
			}

			this.lg.appId = res.appId;
			console.log(`${ID}\x1b[36mLG TV\x1b[0m: TV app -> 📺 \x1b[4m\x1b[37m${res.appId}\x1b[0m`);

			// Turn on/off NVIDIA Shield based on TV current input
			if(this.lg.appId == this.shield.hdmi) this.shield.wake();
			else this.shield.sleep();

			// Set reciever input to TV for non switch
			if(this.lg.appId != this.nswitch.hdmi) {
				if(this.lg.inputTimer) clearTimeout(this.lg.inputTimer);
				this.lg.inputTimer = setTimeout(() => {
					this.rmplus.sendCode("inputtv");
				}, 3000);
			}

			// Change sound mode in receiver
			if(this.lg.appId != "" && this.lg.appId != this.shield.hdmi) this.current_media_app = this.lg.appId;

			// Switch reciever sound mode accordingly
			this.rmplus.emit("changevolume");
		}
	});

	lgtv.subscribe('ssap://com.webos.service.apiadapter/audio/getSoundOutput', (err, res) => {
		if(!res || err || res.errorCode) {
			console.log(`${ID}\x1b[36mLG TV\x1b[0m: Sound Output -> 🔈 Error while getting current sound output | ${err} | ${res}`);
		} else {
			this.lg.soundOutput = res.soundOutput;
			
			// Turn on/off receiver
			if(res.soundOutput == 'external_arc') this.mp1.emit("receiveron");

			console.log(`${ID}\x1b[36mLG TV\x1b[0m: Sound Output -> 🔈 ${res.soundOutput}`);
		}
	});
});
// When all devices except TV is on
devices.on('mostready', function() {
	console.log(`${ID}\x1b[4mMost devices are ready...\x1b[0m`);
	

	// Pioner Reciever IR Command

	this.rmplus.on("changevolume", () => {
		var dev = this.rmplus;

		clearTimeout(this.rmplus.timer);
		this.rmplus.timer = setTimeout(() => {
			// Check LG TV and NVIDIA Shield Active app
			// Set reciever mode based on the stereo list
			if(app_stereo.includes(this.current_media_app)) {
				// Set reciever mode to extra-stereo
				if(dev.sound_mode != "stereo") {
					dev.sound_mode = "stereo";
					dev.sendCode("soundalc", "soundstereo"); // Add longer delay
					console.log(`${ID}\x1b[35mBroadlink\x1b[0m: Sound -> 🔈 \x1b[4m\x1b[37mStereo Sound\x1b[0m`);
					lgtv.request('ssap://system.notifications/createToast', { message: "Sound: Stereo" });
				}
			} else if(this.lg.appId != "") {
				// Set reciever mode to auto surround sound for other
				if(dev.sound_mode != "soundauto") {
					dev.sound_mode = "soundauto";
					dev.sendCode("soundalc", "soundauto"); // Add longer delay
					console.log(`${ID}\x1b[35mBroadlink\x1b[0m: Sound -> 🔈 \x1b[4m\x1b[37mSurround Sound\x1b[0m`);
					lgtv.request('ssap://system.notifications/createToast', { message: "Sound: Auto Surround" });
				}
			}
		}, 1500);
	});


	// Pioner Reciever Power

	this.mp1.on('receiveron', () => {
		if(this.mp1.timer) clearTimeout(this.mp1.timer);
		this.mp1.timer = setTimeout(() => {
			this.mp1.set_power(3,1);
			console.log(`${ID}\x1b[33mBroadlink MP\x1b[0m: Pioneer Receiver -> 🔌 \x1b[1mON\x1b[0m`);	
		}, 1000);
	});
	this.mp1.on('receiveroff', () => {
		if(this.mp1.timer) clearTimeout(this.mp1.timer);
		this.mp1.timer = setTimeout(() => {
			this.mp1.set_power(3,0);
			console.log(`${ID}\x1b[33mBroadlink MP\x1b[0m: Pioneer Receiver -> 🔌 \x1b[2mOFF\x1b[0m`);
		}, 1000);
	});

	// NVIDIA Switch

	this.shield.firstrun = true;
	this.shield.status((status) => {
		this.shield.is_sleep = !status;
		if(!this.shield.is_sleep) {
			console.log(`${ID}\x1b[32mNvidia Shield\x1b[0m: Status -> \x1b[1m🌞 Wake\x1b[0m`);
			// maje
			if(this.shield.firstrun) {
				this.shield.wake();
				this.shield.firstrun = false;
			}
		} else console.log(`${ID}\x1b[32mNvidia Shield\x1b[0m: Status -> \x1b[2m🛌 Sleep\x1b[0m`);
	});

	this.shield.on('currentappchange', (currentapp) => {
		if(currentapp == "org.xbmc.kodi") lgtv.request('ssap://system.notifications/createToast', { message: "Go to sleep 🐒" });
		this.shield.wake();
		console.log(`${ID}\x1b[32mNvidia Shield\x1b[0m: Active App -> 📱 \x1b[4m\x1b[37m${currentapp}\x1b[0m`);
	});

	this.shield.on('currentmediaappchange', (currentapp) => {
		// If current media app change, trigger RM Plus event, to change sound mode in receiver
		this.current_media_app = currentapp;

		this.rmplus.emit("changevolume");
		this.shield.wake();

		console.log(`${ID}\x1b[32mNvidia Shield\x1b[0m: Active Media App -> 📱 \x1b[4m\x1b[37m${this.current_media_app}\x1b[0m`);
	});

	// When shield is awake
	this.shield.on('awake', () => {
		if(!this.lg) return;
		
		if(this.shield.is_sleep) console.log(`${ID}\x1b[32mNvidia Shield\x1b[0m: Status -> \x1b[1mWaking up\x1b[0m`);
		this.shield.is_sleep = false;

		// Wake up tv, the reciever should automatically on also
		if(this.lg.appId == "") this.rmplus.sendCode("tvpower");

		// Delayed to make sure everything is on first
		if(this.lg.timer) clearTimeout(this.lg.timer);
		this.lg.timer = setTimeout(() => {
			// Set input to HDMI1
			lgtv.request('ssap://system.launcher/launch', {id: this.shield.hdmi});

			// Set reciever to TV input
			this.rmplus.sendCode("inputtv");
		}, 1000);
	});

	this.shield.on('sleep', () => {
		if(!this.lg) return;

		console.log(`${ID}\x1b[32mNvidia Shield\x1b[0m: Status -> \x1b[2mGoing to Sleep\x1b[0m`);
		this.shield.is_sleep = true;

		// If Shield is sleeping while in input HDMI1 then turn off TV
		if(this.lg.appId == this.shield.hdmi) {
			this.current_media_app = "";
			// Turn off tv
			lgtv.request('ssap://system/turnOff');
		}
	});

	this.shield.subscribe();


	// Nintendo Switch

	this.nswitch.on('awake', () => {
		if(!this.lg) return;

		// Wake up tv
		if(this.lg.appId == "") this.rmplus.sendCode("tvpower");

		// Switch to Pioneer input
		lgtv.request('ssap://system.launcher/launch', {id: this.nswitch.hdmi});

		if(this.lg.appId == this.nswitch.hdmi) {
			// Delayed to make sure everything is on first
			setTimeout(() => {
				// Set reciever to Switch input
				this.rmplus.sendCode("inputswitch");
			}, 1000);
		}

		console.log(`${ID}\x1b[33mNintendo Switch\x1b[0m: Status -> \x1b[1m🌞 Wake\x1b[0m`);
	});

	this.nswitch.on('sleep', () => {
		if(!this.lg) return;;

		// If Switch is sleeping while in input HDMI2 then turn on NVIDIA Shield
		if(this.lg.appId == this.nswitch.hdmi) {
			this.current_media_app = "";
			this.shield.wake();
		}

		console.log(`${ID}\x1b[33mNintendo Switch\x1b[0m: Status -> \x1b[2m🛌 Sleep\x1b[0m`);
	});

	this.nswitch.subscribe();
});
// At the beginning loop until all devices are connected
devices.mostready = false;
let devicecheck = setInterval(() => {
	if(devices.lg != null && devices.nswitch != null && devices.mp1 != null && devices.rmplus != null && devices.shield != null) {
		if(!devices.mostready) devices.emit('mostready');
		devices.emit('ready');
		clearInterval(devicecheck);
	} else if(devices.nswitch != null && devices.mp1 != null && devices.rmplus != null && devices.shield != null) {
		this.force_emit = true;
		devices.emit('mostready');
		devices.mostready = false;
		clearInterval(devicecheck);
	}
}, 1000);


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