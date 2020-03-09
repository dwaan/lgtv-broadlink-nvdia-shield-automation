'use strict';

var broadlink = require('./node_modules/broadlinkjs-sm');
var lgtv = require('./node_modules/lgtv2/index.js')({
	url: 'ws://192.168.1.105:3000'
});
var mp1_device = null,
	lgtv_device = null;

var b = new broadlink();
b.discover();

lgtv.on('error', function (err) {
	console.log(err);
});

lgtv.on('connecting', function () {
	console.clear();
	console.log('TV: Connecting LG TV ...');
});

lgtv.on('connect', function () {
	var util  = require('util'),
		spawn = require('child_process').spawn;

	console.log('TV: Connected to LG TV');
	console.log(' ');

	lgtv.subscribe('ssap://audio/getVolume', function (err, res) {
		if (res.changed && res.changed.indexOf('volume') !== -1) console.log('volume changed ->', res.volume);
		if (res.changed && res.changed.indexOf('muted') !== -1) console.log('is muted?', res.muted);
	});

	lgtv.subscribe('ssap://com.webos.applicationManager/getForegroundAppInfo', function (err, res) {
		var adb;

		lgtv_device = res;

		// If input not hdmi1, do something with NVIDIA Shield
		if (res.appId == 'com.webos.app.hdmi1') {
			console.log("TV: NVIDIA Shield -> Wake");
			adb = spawn('adb', ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
		} else {
			console.log("TV: NVIDIA Shield -> Sleep");
			adb = spawn('adb', ['shell', 'input', 'keyevent', 'KEYCODE_SLEEP']);
		}

		// If input is Live TV and YouTube make Reciever sounds Stereo other is Surround Sound
		if (res.appId == "") {
			console.log("TV: TV -> Off");
			if(mp1_device != null) mp1_device.set_power(4,0);
		} else if (res.appId == "com.webos.app.livetv" || res.appId == "youtube.leanback.v4") {
			console.log(res.appId, "-> Stereo Sound");
			console.log("TV: TV -> On");
			if(mp1_device != null) mp1_device.set_power(3,1);
		} else {
			console.log("TV: TV -> On");
			console.log(res.appId, "-> Surround Sound");
			if(mp1_device != null) mp1_device.set_power(3,1);
		}
	});
});

lgtv.on('prompt', function () {
	console.log('Please authorize on LG TV');
});

lgtv.on('close', function () {
	console.log('TV: Close');
});

b.on("deviceReady", (dev) => {
	if (dev.type == "MP1") {
		var status = [];

		mp1_device = dev;

		dev.check_power();
		dev.on("mp_power", (status_array) => {
			status = status_array;

			console.log("");
			// Device id is array index + 1
			console.log("Bl: Switch Power -> " + status_array[0]);
			console.log("Bl: Shield Power -> " + status_array[1]);
			console.log("Bl: Pioneer Power -> " + status_array[2]);
			console.log("Bl: Amlogic Power -> " + status_array[3]);
			console.log(lgtv_device);

			if(lgtv_device != null) {
				if (lgtv_device.appId == "") {
					console.log("Bl: TV -> Off");
					dev.set_power(3,0);
				} else {
					console.log("Bl: TV -> On");
					dev.set_power(3,1);
				}
			}
		});
	} else {
		console.log(dev.type + "@" + dev.host.address + " found... not MP1!");
		dev.exit();
	}
});