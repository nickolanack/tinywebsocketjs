/**
 * 
 */
var events = require('events');


function WebsocketServer(options) {

	var me = this;
	// Simple websocket server
	events.EventEmitter.call(me);
	me.clients = [];
	var counter=0;
	me.closeClient = function(client) {
		var i = me.clients.indexOf(client);
		if (i >= 0) {
			console.log('ws:' + i + ' client closed');
			me.clients.splice(i, 1);
		}
	};

	me._handlers = {};


	var config = {
		port: 8080
	};

	Object.keys(options).forEach(function(key) {
		config[key] = options[key];
	});

	me.server = (new(require('ws').Server)({
		port: config.port
	}, function() {
		me.emit('open');
	})).on('connection', function(client) {

		var clientId=counter;
		counter++;
		me.clients.push(client);
		console.log('client connected: ' + client);

		client.on('message', function(data) {



			var request = JSON.parse(data);
			//console.log([data, request]);
			var id = request.id;
			var task = request.task;
			var arguments = request.json;
			arguments.request_id = id;
			arguments.client = client;
			arguments.client_id=clientId;


			if ((typeof me._handlers[task]) == 'function') {

				me._handlers[task]({
					args: arguments,
					client: client,
					id: id,
					cid:clientId
				}, function(response) {


					var text = me._prepareResponse(response);
					client.send(id + ':' + text);

				});

			}



		}).on('close', function(code, message) {
			var i = me.clients.indexOf(client);
			if (i >= 0) {
				console.log('ws:' + i + ' client closed: ' + code + ' ' + message);
				me.clients.splice(i, 1);
			}
		});



	}).on('error', function(error) {

		console.log('error: ' + error);

	});



	//gpio.on('change', function(pin, value) {
	//   console.log('notify device: '+pin+' state change: '+value);
	//    
	//});


	console.log('websocket listening on: ' + config.port);

}


WebsocketServer.prototype.__proto__ = events.EventEmitter.prototype;
WebsocketServer.prototype.stop = function() {
	var me = this;
	console.log('websocker server stopped');
	me.server.close();
}

WebsocketServer.prototype.broadcast = function(name, message, filterClient) {
	var me = this;
	var text = me._prepareResponse(message);
	me.clients.forEach(function(client) {

		if ((typeof filterClient) == 'function') {
			if (filterClient(client)) {
				console.log('broadcast client');
				client.send(name + ':' + text, function(err) {
					if (err) {
						me.closeClient(client);
					}
				});
			} else {
				//console.log('skip client');
			}
		} else {
			client.send(name + ':' + text, function(err) {
				if (err) {
					me.closeClient(client);
				}
			});
		}

	});
}

WebsocketServer.prototype.addTask = function(name, callback) {
	var me = this;
	if (!me._handlers) {
		me._handlers = {};
	}
	me._handlers[name] = callback;
	return me;
}


WebsocketServer.prototype._prepareResponse = function(response) {
	if ((typeof response) == 'object') {
		return JSON.stringify(response);
	}

	if ((['string', 'number']).indexOf(typeof response) >= 0) {
		return response;
	}

	throw new Error('Unknown response type ' + (typeof response));

}



WebsocketServer.Client = function(options, callback) {


	var me = this;

	me._handlers = [];
	me._timers = [];

	me._counter = 0;

	me._connect(options.url, callback);

}
WebsocketServer.Client.prototype.__proto__ = events.EventEmitter.prototype;
WebsocketServer.Client.prototype._connect= function(url, callback) {

	var me = this;

	try {


		var WebSocket = require('ws');
		me._ws = new WebSocket(url);

		me._ws.on('open', function() {
			callback(me);
			me.emit('open');
		});



		console.log('started websocket: ws');



		me._ws.on('error', function() {
			console.log('recieved error! ');
		});

		me._ws.on('message', function (message) {
			me._handleMessage(message);
		});

		me._ws.on('close', function(message) {
			me.emit('close');
			me._connect(url, function(ws) {
				me._ws = ws;
				me.emit('reconnect');
			});
		});

	} catch (e) {
		console.log('error connecting to websocket');
	}


};
WebsocketServer.Client.prototype.send = function(task, json, callback) {
	var me = this;
	var id = me._counter;
	me._counter++;

	if(callback){
		me._handlers['_' + id] = callback;
	}
	
	me._ws.send(JSON.stringify({
		id: id,
		task: task,
		json: json
	}));
	me._timerStart(id);
};
WebsocketServer.Client.prototype._timerStart = function(id) {
	var me = this;
	//not supported by safari.
	
	me._timers['_' + id] = new Date().getTime();
	
};
WebsocketServer.Client.prototype._timerStop = function(c) {
	var me = this;
	var time = -1;
	

	time = new Date().getTime() - me._timers['_' + c];
	delete me._timers['_' + c];
	
	return time;
};
WebsocketServer.Client.prototype._handleMessage = function(message) {
	var me = this;

	var data = message;
	var i = data.indexOf(':');
	var id = data.substring(0, i);
	data = data.substring(i + 1);


	if (!me._handlers['_' + id]) {
		me.emit(id, data);
		console.log("unhandled message: "+'_' + id+"=>"+data)

	} else {
		var time = me._timerStop(id);
		me._handlers['_' + id](data);
		console.log('ws ' + id + ':' + time);

		delete me._handlers['_' + id];
	}
};

module.exports = WebsocketServer;