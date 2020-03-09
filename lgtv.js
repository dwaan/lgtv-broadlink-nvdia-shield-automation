'use strict';

var broadlink = require('broadlinkjs-sm'),
	lgtv = require('lgtv2/index.js')({
		url: 'ws://192.168.1.105:3000' // put your LG TV ip address
	}),
	spawn = require('child_process').spawn,
	lg_device = null,
	mp1 = new broadlink(),
	mp1_device = null,
	adb = null;

console.log('\n\x1b[4mConnecting...\x1b[0m', "\n");

// Connect to Shield

adb = spawn('adb', ['connect', '192.168.1.106']);

adb.stdout.on('data', (data) => {
  console.log("\x1b[32mNS\x1b[0m: \x1b[1mConnected\x1b[0m");
});

adb.stderr.on('data', (data) => {
  console.log("\x1b[32mNS\x1b[0m: \x1b[2mNot Connected\x1b[0m");
});


// Connect to Broadlink when TV is connected

mp1.discover();

mp1.on("deviceReady", (dev) => {
	if (dev.type == "MP1") {
		var status = [];

		mp1_device = dev;
		console.log("\x1b[33mBL\x1b[0m: \x1b[1mConnected\x1b[0m");

		dev.on("mp_power", (status_array) => {
			// Device id is array index + 1
			if(lg_device != null) {
				// When TV is on turn on switch #3
				setTimeout(function() {
					if (lg_device.appId != "")  {
						if(!status_array[2]) {
							console.log("\x1b[33mBL\x1b[0m: Broadlink MP1 Switch #3 -> \x1b[1mON\x1b[0m")
							dev.set_power(3,1);
						}
					} else {
						if(status_array[2]) {
							console.log("\x1b[33mBL\x1b[0m: Broadlink MP1 Switch #3 -> \x1b[2mOFF\x1b[0m")
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


// Connect to LG TV

lgtv.on('connect', function () {
	console.log("\x1b[36mTV\x1b[0m: \x1b[1mConnected\x1b[0m");

	lgtv.subscribe('ssap://audio/getVolume', function (err, res) {
		console.log("\x1b[36mTV\x1b[0m: Check TV volume status");
		if (res.changed && res.changed.indexOf('volume') !== -1) console.log('\x1b[36mTV\x1b[0m: Volume ->', res.volume);
		if (res.changed && res.changed.indexOf('muted') !== -1) console.log('\x1b[36mTV\x1b[0m: Mute ->', res.muted);
	});

	lgtv.subscribe('ssap://com.webos.applicationManager/getForegroundAppInfo', function (err, res) {
		lg_device = res;

		// If input is Live TV and YouTube make Reciever sounds Stereo other is Surround Sound
		console.log("\x1b[36mTV\x1b[0m: Check TV power status");
		if (res.appId == "") {
			console.log("\x1b[36mTV\x1b[0m: TV -> \x1b[2mOff\x1b[0m");
		} else if (res.appId == "com.webos.app.livetv" || res.appId == "youtube.leanback.v4") {
			console.log("\x1b[36mTV\x1b[0m:", res.appId, "-> \x1b[1mStereo Sound\x1b[0m");
			console.log("\x1b[36mTV\x1b[0m: TV -> \x1b[1mOn\x1b[0m");
		} else {
			console.log("\x1b[36mTV\x1b[0m:", res.appId, "-> \x1b[1mSurround Sound\x1b[0m");
			console.log("\x1b[36mTV\x1b[0m: TV -> \x1b[1mOn\x1b[0m");
		}

		if(mp1_device != null) mp1_device.check_power();

		// If input not hdmi1 make NVIDIA Shield SLEEP
		if (res.appId == 'com.webos.app.hdmi1') {
			console.log("\x1b[36mTV\x1b[0m: NVIDIA Shield -> \x1b[1mWake\x1b[0m");
			spawn('adb', ['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
		} else {
			console.log("\x1b[36mTV\x1b[0m: NVIDIA Shield -> \x1b[2mSleep\x1b[0m");
			spawn('adb', ['shell', 'input', 'keyevent', 'KEYCODE_SLEEP']);
		}
	});
});

lgtv.on('prompt', function () {
	console.log('Please authorize on LG TV');
});

lgtv.on('close', function () {
	console.log('\x1b[36mTV\x1b[0m: Close');
});

lgtv.on('error', function (err) {
	console.log(err);
});