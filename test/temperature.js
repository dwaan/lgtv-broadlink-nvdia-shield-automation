#!/usr/bin/env node

const axios = require('axios').default;

let apiKey = '40dc2517a33b8ddb7aac60c64a7b3f80';
let city = 'tel-aviv';
let url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`

axios.get(url)
	.then(function (response) {
		console.log(response.data.main.temp);
	})
	.catch(function () {
		console.log(25);
	})