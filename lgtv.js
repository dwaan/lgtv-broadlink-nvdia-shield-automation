'use strict';

var broadlink = require('./node_modules/broadlinkjs-sm'),
	lgtv = require('./node_modules/lgtv2/index.js')({
		url: 'ws://192.168.1.105:3000' // put your LG TV ip address
	}),
	lg_device = null,
	mp1 = new broadlink(),
	mp1_device = null;

lgtv.on('error', function (err) {
	console.log(err);
});

lgtv.on('connecting', function () {
	console.log("-------------------------");
	console.log('TV: Connecting LG TV ...');
});

lgtv.on('connect', function () {
	var util  = require('util'),
		spawn = require('child_process').spawn;

	console.log('TV: Connected to LG TV');

	// Connect to Broadlink when TV is connected
	mp1.discover();
	mp1.on("deviceReady", (dev) => {
		if (dev.type == "MP1") {
			var status = [];

			mp1_device = dev;

			console.log("")
			console.log("BL: Connected to Broadlink MP1")
			console.log("")

			dev.on("mp_power", (status_array) => {
				// Device id is array index + 1
				if(lg_device != null) {
					// When TV is on turn on switch #3
					setTimeout(function() {
						if (lg_device.appId != "")  {
							if(!status_array[2]) {
								console.log("BL: Broadlink MP1 Switch #3 -> ON")
								dev.set_power(3,1);
							}
						} else {
							if(status_array[2]) {
								console.log("BL: Broadlink MP1 Switch #3 -> OFF")
								dev.set_power(3,0);
							}
						}
					}, 1000);
				}
			});
		} else {
			console.log(dev.type + "@" + dev.host.address + " found... not MP1!");
			dev.exit();
		}
	});

	lgtv.subscribe('ssap://audio/getVolume', function (err, res) {
		console.log("");
		console.log("TV: Check TV volume status");
		if (res.changed && res.changed.indexOf('volume') !== -1) console.log('volume changed ->', res.volume);
		if (res.changed && res.changed.indexOf('muted') !== -1) console.log('is muted?', res.muted);
	});

	lgtv.subscribe('ssap://com.webos.applicationManager/getForegroundAppInfo', function (err, res) {
		var adb;

		lg_device = res;

		// If input is Live TV and YouTube make Reciever sounds Stereo other is Surround Sound
		console.log("");
		console.log("TV: Check TV power status");
		if (res.appId == "") {
			console.log("TV: TV -> Off");
		} else if (res.appId == "com.webos.app.livetv" || res.appId == "youtube.leanback.v4") {
			console.log(res.appId, "-> Stereo Sound");
			console.log("TV: TV -> On");
		} else {
			console.log("TV: TV -> On");
			console.log(res.appId, "-> Surround Sound");
		}

		if(mp1_device != null) mp1_device.check_power();

		// If input not hdmi1 make NVIDIA Shield SLEEP
		if (res.appId == 'com.webos.app.hdmi1') {
			console.log("TV: NVIDIA Shield -> Wake");
			adb = spawn('adb', ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
		} else {
			console.log("TV: NVIDIA Shield -> Sleep");
			adb = spawn('adb', ['shell', 'input', 'keyevent', 'KEYCODE_SLEEP']);
		}
	});
});

lgtv.on('prompt', function () {
	console.log('Please authorize on LG TV');
});

lgtv.on('close', function () {
	console.log('TV: Close');
});