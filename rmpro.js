/*
	usage:

	When you want to learn a code, it might took several times for the correct code
		node rmpro.js learn input-name

	When you want to sendthe code
		node rmpro.js send input-name
*/

'use strict';
let broadlink = require('broadlinkjs');
let fs = require('fs');
let path = require('path');

var b = new broadlink();
var learn = process.argv[2];
var file = process.argv[3];

b.on("deviceReady", (dev) => {
	if(dev.host.address == "192.168.1.103") {
		console.log("Connected -> RM3 Pro+")
		if (learn == "learn" || learn == "l") {
			console.log("Waiting for input ->", file);
			var timer = setInterval(function(){
				dev.checkData();
			}, 500);

			dev.on("temperature", (temp)=>{
				dev.enterLearning();
			});

			dev.on("rawData", (data) => {
				fs.writeFile("code/" + file + ".bin", data, function(err) {
					if(err) {
						return console.log(err);
					}

					console.log("The file was saved!");

					var timer = setInterval(function(){
						clearInterval(timer);
						process.exit();
					}, 500);
				});
			});

			dev.checkTemperature();
		} else {
			// Buffer mydata
			function bufferFile(relPath) {
				return fs.readFileSync(path.join(__dirname, relPath)); // zzzz....
			}

			console.log("Sending data ->", file);
			dev.checkData();
			dev.sendData(bufferFile("code/" + file + ".bin"));

			var timer = setInterval(function(){
				clearInterval(timer);
				process.exit();
			}, 500);
		}
	}
});

b.discover();
