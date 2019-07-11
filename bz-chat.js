#!/usr/bin/env node
var readline = require('readline'),
    socketio = require('socket.io-client'),
    util = require('util'),
    color = require("ansi-color").set;
var io = require('socket.io');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var ioServer = require('socket.io')(server);
const portfinder = require('portfinder');
const arguments = process.argv;
var channelKey = 'general';
var host = 'localhost';
var path = require('path');
const notifier = require('node-notifier');
const encrypt = require('socket.io-encrypt');

if (arguments.indexOf('--host') > 0) {
    host = arguments[arguments.indexOf('--host') + 1];
}

if (arguments.indexOf('--channel') > 0) {
    channelKey = arguments[arguments.indexOf('--channel') + 1];
}

// console.log('host', host);
// console.log('channel', channelKey);

var socket = socketio.connect(`http://${host}:8080`, {'forceNew': true, query: `channelKey=${channelKey}`});
encrypt(channelKey)(socket);

var nick;
var rl = readline.createInterface(process.stdin, process.stdout);


// Set the username
rl.question("Please enter a nickname: ", function (name) {
    nick = name;
    var msg = nick + " has joined the chat";
    socket.emit('send', {type: 'notice', message: msg, key: channelKey});
    rl.prompt(true);
});

function console_out(msg) {
    // process.stdout.clearLine();
    // process.stdout.cursorTo(0);
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0, null);
    console.log(msg);
    rl.prompt(true);
}

rl.on('line', function (line) {
    if (line[0] == "/" && line.length > 1) {
        var cmd = line.match(/[a-z]+\b/)[0];
        var arg = line.substr(cmd.length + 2, line.length);
        chat_command(cmd, arg);

    } else {
        // send chat message
        socket.emit('send', {type: 'chat', message: line, nick: nick});
        rl.prompt(true);
    }
});

function chat_command(cmd, arg) {
    switch (cmd) {

        case 'nick':
            var notice = nick + " changed their name to " + arg;
            nick = arg;
            socket.emit('send', {type: 'notice', message: notice});
            break;

        case 'msg':
            var to = arg.match(/[a-z]+\b/)[0];
            var message = arg.substr(to.length, arg.length);
            socket.emit('send', {type: 'tell', message: message, to: to, from: nick});
            break;

        case 'me':
            var emote = nick + " " + arg;
            socket.emit('send', {type: 'emote', message: emote});
            break;

        default:
            console_out("That is not a valid command.");
    }
}

socket.on(channelKey, function (data) {
    var leader;
    if (data.type === 'chat' && data.nick !== nick) {
        leader = color("<" + data.nick + "> ", "green");
        console_out(leader + data.message);
        if (data.message.indexOf('notify') !== -1) {
            notifier.notify(
                {
                    title: '---',
                    message: '--',
                    icon: path.join(__dirname, 'notification.png'), // Absolute path (doesn't work on balloons)
                    sound: true, // Only Notification Center or Windows Toasters
                    wait: true // Wait with callback, until user action is taken against notification
                },
                function (err, response) {
                    // Response is response from notification
                }
            );
        }
    } else if (data.type === "notice") {
        console_out(color(data.message, 'cyan'));
    } else if (data.type === "tell" && data.to === nick) {
        leader = color("[" + data.from + "->" + data.to + "]", "red");
        console_out(leader + data.message);
    } else if (data.type === "emote") {
        console_out(color(data.message, "cyan"));
    }
});


portfinder.basePort = 8080;    // default: 8000
portfinder.highestPort = 8080; // default: 65535
portfinder.getPortPromise()
    .then((port) => {
        if (port === 8080) {
            app.use(express.static('public'));
            ioServer.use(encrypt(channelKey));
            ioServer.on('connection', function (socket) {
                var channelKey = socket.handshake.query['channelKey'] || 'general';
                // console.log('userKey', channelKey);
                //if (['joe123', 'jane123', 'mary123'].includes(channelKey)) {
                socket.on('send', function (data) {
                    ioServer.sockets.emit(channelKey, data);
                });
                //}
            });
            server.listen(8080, function () {
                // console.log("server running in http://localhost:8080");
            });
        }
    })
    .catch((err) => {
        // console.log('Port is not available');
    });
