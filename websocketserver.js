/**
 * 
 */
var events = require('events');


function WebsocketServer(options){

	var me=this;
	// Simple websocket server
	events.EventEmitter.call(me);
	me.clients = [];
	
	me._handlers={};


	var config={
			port:8080
	};

	Object.keys(options).forEach(function (key) {
		config[key]=options[key];
	});

	me.server=(new (require('ws').Server)({
		port: config.port
	})).on('connection', function(client){

		me.clients.push(client);
		console.log('client connected: '+client);

		client.on('message',function(data){




			var request=JSON.parse(data);
			//console.log([data, request]);
			var id=request.id;
			var task=request.task;
			var arguments=request.json;
			arguments.request_id=id;
			arguments.client=client;
			
			
			if((typeof me._handlers[task])=='function'){
				
				me._handlers[task]({
						args:arguments,
						client:client,
						id:id
					}, function(response){
					
						
					var text=me._prepareResponse(message);				
					client.send(id+':'+text);
					
				});
				
			}


		
		}).on('close',function(code, message){
			var i = me.clients.indexOf(client);
			console.log('ws:'+i+' client closed: '+code+' '+message);
			me.clients.splice(i, 1);
		});
		

		

	}).on('error', function(error){

		console.log('error: '+error);

	});


	//gpio.on('change', function(pin, value) {
	//   console.log('notify device: '+pin+' state change: '+value);
	//    
	//});


	console.log('websocket listening on: '+config.port);

}


WebsocketServer.prototype.__proto__ = events.EventEmitter.prototype;
WebsocketServer.prototype.stop=function(){
	var me=this;
	console.log('websocker server stopped');
	me.server.close();
}

WebsocketServer.prototype.broadcast=function(name, message, filterClient){
	var me=this;
	var text=me._prepareResponse(message);
	me.clients.forEach(function(client){
		
		if((typeof filterClient)=='function'){
			if(filterClient(client)){
				console.log('broadcast client');
				client.send(name+':'+text);
			}else{
				console.log('skip client');
			}
		}else{
			client.send(name+':'+text);	
		}
			
	});
}

WebsocketServer.prototype.addTask=function(name, callback){
	var me=this;
	if(!me._handlers){
		me._handlers={};
	}
	me._handlers[name]=callback;
	return me;
}


WebsocketServer.prototype._prepareResponse=function(response){
	if((typeof response)=='object'){
		return JSON.stringify(response);
	}
	
	if((['string', 'number']).indexOf(typeof response)>=0){
		return  response;
	}
	
	throw new Error('Unknown response type '+(typeof response));
	
}


module.exports=WebsocketServer;