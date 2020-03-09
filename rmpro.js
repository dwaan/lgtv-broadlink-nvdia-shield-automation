'use strict';
let broadlink = require('./node_modules/broadlinkjs');
let fs = require('fs');

var b = new broadlink();

b.discover();

b.on("deviceReady", (dev) => {
	// console.log (dev);
	var timer = setInterval(function(){
		console.log("send check!");
		dev.checkData();
	}, 1000);

	dev.on("temperature", (temp)=>{
		console.log("get temp "+temp);
		dev.enterLearning();
	});

	dev.on("rawData", (data) => {
		console.log(data);
		fs.writeFile("output-rmpro.txt", data, function(err) {
		    if(err) {
		        return console.log(err);
		    }
		    console.log("The file was saved!");
		    clearInterval(timer);
		});
		clearInterval(timer);
	});

	dev.checkTemperature();
});

