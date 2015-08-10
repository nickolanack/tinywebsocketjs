/**
 * 
 */

var assert=require('assert');


var WebServer=require('../websocketserver.js');
var server=(new WebServer({port:8091})).on('open',function(){

	console.log('Test Request');

	server.close();


});

