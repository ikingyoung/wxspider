var helper= require("myhelper");
var Spider = require("./spider.js");
var config = require('./config/config.js');


// var parser = require('xml2json');
console.log('wxspider init...');
var spider = new Spider();
console.log('wxspider start working...');
spider.doWork();