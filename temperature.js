const request = require('request');
const argv = require('yargs').argv;

let apiKey = '792a714c5972745a0c059538681b9d7c';
let city = argv.c || 'tel-aviv';
let url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`

request(url, function (err, response, body) {
  if(err){
    console.log('error:', error);
  } else {
    let weather = JSON.parse(body);
    let message = `It's ${weather.main.temp} degrees in ${weather.name}!`;
    console.log(Math.round(weather.main.temp));
  }
});