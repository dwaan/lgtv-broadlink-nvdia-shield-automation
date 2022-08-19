#!/usr/bin/env node

/*
	usage:

	When you want to learn a code, it might took several times before the correct code saved
		node rmpro.js learn input-name

	When you want to send the code
		node rmpro.js send input-name

	When you want to read the code
		node rmpro.js read input-name
*/

'use strict';
let broadlink = require('broadlinkjs-dw');
let fs = require('fs');
let path = require('path');

var b = new broadlink();

// Buffer mydata
function bufferFile(relPath) {
	return fs.readFileSync(path.join(__dirname, relPath)); // zzzz....
}

var ircodes = [];
fs.readdir("../code/", (_, files) => {
	var i = 0;
	files.forEach(file => {
		if (!file.includes(".bin")) return;
		ircodes.push(file.replace(".bin", ""));
	});

	if (process.argv.length < 3) {
		console.log("Usage:\n", "\tnode rmpro send (command)", "\n");
		console.log("Available command:");
		console.log(ircodes.toString());
	} else {
		var learn = process.argv[2];
		var file = process.argv[3];
		var _file = process.argv[4];

		if (learn == "read" || learn == "r") {
			// Buffer mydata
			var data = bufferFile("../code/" + file + ".bin");
			data = new Buffer.from(data, 'ascii').toString('hex');

			console.log("Code -> " + data);

			process.exit();
		} else if (learn == "convert" || learn == "c") {
			var data = Buffer.from(file, 'base64');

			console.log(data);

			fs.writeFile("../code/" + _file + ".bin", data, function (err) {
				if (err) {
					return console.log(err);
				}

				console.log("The file was saved!");

				process.exit();
			});
		} else {
			b.on("deviceReady", (dev) => {
				console.log("Found:", dev.type, dev.host.address);

				if (dev.type == "RMPro") {
					console.log("Connected -> " + dev.host.address)
					if (learn == "learn" || learn == "l") {
						console.log("Waiting for input ->", file);
						var timer = setInterval(function () {
							dev.checkData();
						}, 500);

						dev.on("rawData", (data) => {
							fs.writeFile("../code/" + file + ".bin", data, function (err) {
								if (err) {
									return console.log(err);
								}

								console.log("The file was saved!");

								data = new Buffer.from(data, 'ascii').toString('hex');

								console.log("Code -> " + data);

								process.exit();
							});
						});

						dev.enterLearning();
					} else if (learn == "listen") {
						console.log("Waiting for input", "\r");

						var timer = setInterval(function () {
							dev.checkData();
						}, 500);

						dev.on("rawData", (data) => {
							data = new Buffer.from(data, 'ascii').toString('hex');
							console.log(`Data: ${data}`);

							ircodes.forEach(file => {
								var fileData = bufferFile("../code/" + file + ".bin");
								fileData = new Buffer.from(fileData, 'ascii').toString('hex');

								console.log(`${file} ${data - fileData}`);
								if (data == fileData) console.log(`File: ${file}`);
							})
							dev.enterLearning();
						});

						dev.enterLearning();
					} else {
						var data = new Buffer.from(file, 'ascii');
						dev.sendData(data);

						var data = bufferFile("../code/" + file + ".bin");
						data = new Buffer.from(data, 'ascii').toString('hex');

						console.log("Sending ->", file);
						console.log("Data ->", data);

						process.exit();
					}
				}
			});
		}

		b.discover();
	}
});
