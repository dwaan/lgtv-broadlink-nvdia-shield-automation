var lgtv = require('lgtv2')({
	url: 'ws://192.168.1.105:3000'
});

lgtv.on('error', function (err) {
	console.log(err);
});

lgtv.on('connecting', function () {
    console.log('connecting');
});

lgtv.on('connect', function () {
	lgtv.request('ssap://system.notifications/createToast', {message: "All devices are connected"});

	lgtv.subscribe('ssap://api/getServiceList', function (err, res) {
		// console.log("\ngetServiceList");
		// console.log(res);
	});

	var options = {};
    options.callbackInterval = 1;
    options.subscribe = true;
    options.sleep = true;
    options.autoAlign = false;

	lgtv.subscribe('ssap://com.webos.service.mrcu/sensor/getSensorData', options, function (err, res) {
		console.log(err, res);
	});
});

lgtv.on('prompt', function () {
	console.log('\nplease authorize on TV');
});

lgtv.on('close', function () {
	console.log('\nclose');
});