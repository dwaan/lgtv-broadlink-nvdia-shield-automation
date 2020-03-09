'use strict';

var broadlinksm = require('broadlinkjs-sm'),
	broadlink = require('../broadlinkjs'),
	fs = require('fs'),
	path = require('path'),
	exec = require('child_process').exec,
	lgtv = require('lgtv2/index.js')({
		url: 'ws://192.168.1.105:3000' // put your LG TV ip address
	}),
	spawn = require('child_process').spawn,
	lg_device = null,
	mp1 = new broadlinksm(),
	mp1_device = null,
	rmplus = new broadlink(),
	rmplus_device = null,
	adb = null,
	active_nvidia_app = null;

console.log('\n\x1b[4mConnecting...\x1b[0m', "\n");


// Connect to Broadlink RM Plus
rmplus.on("deviceReady", (dev) => {
	if (dev.type == "DEVICE") {
		console.log("\x1b[33mRP\x1b[0m: \x1b[1mConnected\x1b[0m");
		rmplus_device = dev;

		dev.checkData();
		dev.on("rawData", (data) => {
			function bufferFile(relPath) {
				return fs.readFileSync(path.join(__dirname, relPath));
			}

			if (lg_device != null) {
				// Check LG TV Active app
				if (lg_device.appId == "com.webos.app.livetv" || lg_device.appId == "youtube.leanback.v4") {
					// Set reciever mode to extra-stereo
					dev.sendData(bufferFile("code/soundalc.bin"));
					dev.sendData(bufferFile("code/soundstereo.bin"));
					console.log("\x1b[36mRP\x1b[0m:", lg_device.appId, "-> \x1b[1mStereo Sound\x1b[0m");
					console.log("\x1b[36mRP\x1b[0m: TV -> \x1b[1mOn\x1b[0m");
				} else if (lg_device.appId == "com.webos.app.hdmi1") {
					// Set reciever mode to extra-stereo
					if(
						active_nvidia_app == "com.cloudmosa.puffinTV" ||
						active_nvidia_app == "com.android.chrome" ||
						active_nvidia_app == "com.nickonline.android.nickapp" ||
						active_nvidia_app == "com.nvidia.bbciplayer" ||
						active_nvidia_app == "com.google.android.youtube.tv" ||
						active_nvidia_app == "com.turner.cnvideoapp"
					) {
						// Set reciever mode to extra-stereo
						dev.sendData(bufferFile("code/soundalc.bin"));
						dev.sendData(bufferFile("code/soundstereo.bin"));
						console.log("\x1b[36mRP\x1b[0m:", lg_device.appId, "-> \x1b[1mStereo Sound\x1b[0m");
						console.log("\x1b[36mRP\x1b[0m: TV -> \x1b[1mOn\x1b[0m");
					} else {
						// Set reciever mode to auto surround sound
						dev.sendData(bufferFile("code/soundalc.bin"));
						dev.sendData(bufferFile("code/soundauto.bin"));
						console.log("\x1b[36mRP\x1b[0m:", lg_device.appId, "-> \x1b[1mSurround Sound\x1b[0m");
						console.log("\x1b[36mRP\x1b[0m: TV -> \x1b[1mOn\x1b[0m");
					}
				} else {
					// Set reciever mode to auto surround sound
					dev.sendData(bufferFile("code/soundalc.bin"));
					dev.sendData(bufferFile("code/soundauto.bin"));
					console.log("\x1b[36mRP\x1b[0m:", lg_device.appId, "-> \x1b[1mSurround Sound\x1b[0m");
					console.log("\x1b[36mRP\x1b[0m: TV -> \x1b[1mOn\x1b[0m");
				}
			}
		});
	}
});

rmplus.discover();



// Connect to Broadlink MP1

mp1.discover();

mp1.on("deviceReady", (dev) => {
	if (dev.type == "MP1") {
		var status = [];

		mp1_device = dev;
		console.log("\x1b[33mMP\x1b[0m: \x1b[1mConnected\x1b[0m");

		dev.on("mp_power", (status_array) => {
			// Device id is array index + 1
			if(lg_device != null) {
				// When TV is on turn on switch #3 but with a bit of delay
				// so TV turn off sound didn't cutted
				setTimeout(function() {
					if (lg_device.appId != "")  {
						if(!status_array[2]) {
							console.log("\x1b[33mMP\x1b[0m: Broadlink MP1 Switch #3 -> \x1b[1mON\x1b[0m")
							dev.set_power(3,1);
						}
					} else {
						if(status_array[2]) {
							console.log("\x1b[33mMP\x1b[0m: Broadlink MP1 Switch #3 -> \x1b[2mOFF\x1b[0m")
							dev.set_power(3,0);
						}
					}
				}, 1000);
			}
		});
	}
});

// Connect to Shield

adb = spawn('adb', ['connect', '192.168.1.106']);  // put your NVIDIA Shield ip address

adb.stdout.on('data', (data) => {
	console.log("\x1b[32mNS\x1b[0m: \x1b[1mConnected\x1b[0m");
});

adb.stderr.on('data', (data) => {
	console.log("\x1b[32mNS\x1b[0m: \x1b[2mNot Connected\x1b[0m");
});

setInterval(() => {
	if (lg_device.appId == 'com.webos.app.hdmi1') {
		exec('adb shell dumpsys window | grep -E mFocusedWindow', (err, stdout, stderr) => {
			var result = stdout.split(" u0 ");
			// Sometimes the result is empty
			if (result != "") {
				result = result[1].split("/");
				result = result[0];

				if (active_nvidia_app != result) {
					active_nvidia_app = result;
					console.log("\x1b[32mNS\x1b[0m: Active App ->", active_nvidia_app);
					if(rmplus_device != null) rmplus_device.checkData();
				}
			}
		})
	}
}, 1000);


// Connect to LG TV

lgtv.on('connect', function () {
	console.log("\x1b[36mTV\x1b[0m: \x1b[1mConnected\x1b[0m");

	lgtv.subscribe('ssap://audio/getVolume', function (err, res) {
		if (res.changed && res.changed.indexOf('volume') !== -1) console.log('\x1b[36mTV\x1b[0m: Volume ->', res.volume);
		if (res.changed && res.changed.indexOf('muted') !== -1) console.log('\x1b[36mTV\x1b[0m: Mute ->', res.muted);
	});

	lgtv.subscribe('ssap://com.webos.applicationManager/getForegroundAppInfo', function (err, res) {
		lg_device = res;

		// If input is Live TV and YouTube make Reciever sounds Stereo other is Surround Sound
		console.log("\x1b[36mTV\x1b[0m: Check TV power status");
		if (lg_device.appId == "") {
			console.log("\x1b[36mTV\x1b[0m: TV -> \x1b[2mOff\x1b[0m");
		} else {
			if(rmplus_device != null) rmplus_device.checkData();
		}

		if(mp1_device != null) mp1_device.check_power();

		// If input not hdmi1 make NVIDIA Shield SLEEP
		if (lg_device.appId == 'com.webos.app.hdmi1') {
			console.log("\x1b[36mTV\x1b[0m: NVIDIA Shield -> \x1b[1mWake\x1b[0m");
			spawn('adb', ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
		} else {
			console.log("\x1b[36mTV\x1b[0m: NVIDIA Shield -> \x1b[2mSleep\x1b[0m");
			spawn('adb', ['shell', 'input', 'keyevent', 'KEYCODE_SLEEP']);
		}
	});
});

lgtv.on('prompt', function () {
	console.log('\x1b[36mTV\x1b[0m: Please authorize on LG TV');
});

lgtv.on('close', function () {
	console.log('\x1b[36mTV\x1b[0m: Close');
});

lgtv.on('error', function (err) {
	console.log(err);
});