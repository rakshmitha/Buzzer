/**
 * 
 */

/*
 * 
 * Template for broadcasting message
 * 
 * wss.broadcast(JSON.stringify({ 'label': 'abort desktop connection' }));
 * 
 */

var fs = require("fs");
console.log("Reading settings...");
var contents = fs.readFileSync("server_settings.json");
var settings = JSON.parse(contents);

var playerLimit = settings.player_limit;
var wsPort = parseInt(settings.ws_port);
var serverPort = settings.server_port;
var domainName = settings.server_domain;

var WebSocketServer = require('ws').Server
var wss = new WebSocketServer({
	port : wsPort
}); // TODO: CHANGE TO YOUR OWN PORT
console.log("ws server running on port " + wsPort);

var hostConnected = 0;
//var players = 0;
var firstBuzz = 0;
var connectionsDisabled = 1;
var buzzEnabled = 0;

var players = {};
var numPlayers = 0;
var sidToPidMap = {};

var buzzOrder = [];

var resetting = 0;

wss.on('close', function() {
	console.log('disconnected');
});

wss.broadcast = function(message) {
	var i;
	for (i = 0; i < this.clients.length; i++) {
		this.clients[i].send(message);
	}
}

wss.kick = function() {
	var i;
	for (i = 0; i < this.clients.length; i++) {
		this.clients[i].close();
	}
}

wss.on('connection', function(ws) {
	var sid = sguid();
	// New client connected
	ws.on('message', function(message) {
		// Received a message from a client
		var msg = JSON.parse(message);
		switch (msg.label) {
		case 'host connection':
			if (hostConnected) {
				wss.broadcast(JSON.stringify({
					'label' : 'abort host connection',
					'id'	: msg.id
				}));
			} else {
				sidToPidMap[sid] = -1;
				console.log("Host sid: " + sid)
				hostConnected = 1;
				connectionsDisabled = 0;
				wss.broadcast(JSON.stringify({
					'label' : 'accepted host connection',
					'id'	: msg.id
				}));
			}
			break;
		case 'client connection':
			if (connectionsDisabled || numPlayers >= playerLimit) {
				wss.broadcast(JSON.stringify({
					'label' : 'abort client connection',
					'id'	: msg.id
				}));
			} else {
				numPlayers += 1;
				pid = getAvailablePID();
				players[pid] = msg.id;
				sidToPidMap[sid] = pid;
				wss.broadcast(JSON.stringify({
					'label' : 'accepted client connection',
					'pid' 	: pid,
					'id'	: msg.id
				}));
			}
			break;
		case 'toggle connections':
			if (connectionsDisabled) {
				connectionsDisabled = 0;
			} else {
				connectionsDisabled = 1;
			}
			break;
		case 'enable buzz':
			buzzEnabled = 1;
			buzzOrder = [];
			wss.broadcast(JSON.stringify({
				'label' : 'enable buzz',
			}));
			break;
		case 'buzz':
			if (buzzEnabled) {
				var pid = msg.pid;
				if (buzzOrder.indexOf(pid) == -1) {
					buzzOrder.push(pid);
					wss.broadcast(JSON.stringify({
						'label' : 'buzz order',
						'order' : buzzOrder
					}));
				}
			}
			break;
		case 'disable buzz':
			buzzEnabled = 0;
			buzzOrder = [];
			wss.broadcast(JSON.stringify({
				'label' : 'disable buzz'
			}));
			break;
		default:
			// Nothing
		}
	});
	ws.on('close', function() {
		if (!resetting) {
			var pid = sidToPidMap[sid];
			if (pid == -1) {
				//host disconnected
				console.log("Host disconnected! Resetting server.");
				resetting = 1;
				wss.kick();
				hostConnected = 0;
				firstBuzz = 0;
				connectionsDisabled = 1;
				buzzEnabled = 0;
				players = {};
				numPlayers = 0;
				sidToPidMap = {};
				resetting = 0;
			} else {
				//client disconnected
				if (pid) {
					console.log("Player " + pid + " diconnected.");
					numPlayers -= 1;
					players[pid] = null;
					sidToPidMap[sid] = null;
					wss.broadcast(JSON.stringify({
						'label' : 'client disconnected',
						'pid'	: pid
					}));
				}
			}
		}
	});
});

var player_list = ['Aavinash','Alvis','Augustin','Aishwarya','Charles','Gokul','Kamal','Karthik','Palani','Rakshmitha','Sameena','Sanjay','Vaishnavi','Vyshnavi','Vignesh','Yagan']
var j = -1;

var getAvailablePID = function() {
	for (var i = 1; i <= playerLimit; i++) {
		if (!players[i]) {
			j++;
			return player_list[j];
		}
	}
	return -1;
}

function sguid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return 's' + s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

// express serving front
var express = require('express');
var serveStatic = require('serve-static');
var app = express();
app.use(serveStatic(__dirname));
app.listen(serverPort);
console.log("express server running on port " + serverPort);
console.log("connect with " + domainName + ":"+ serverPort + "/host.html or /button.html");

// fetch files via
// http://cslinux.utm.utoronto.ca:10021/host.html
// or
// http://cslinux.utm.utoronto.ca:10021/button.html
