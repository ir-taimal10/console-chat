#!/usr/bin/env node
import readline from 'readline';
import socketio from 'socket.io-client';
import {set} from "ansi-color";
import express from 'express';
import httpServer from 'http';
import SocketIo from 'socket.io';
import notifier from 'node-notifier';
import encrypt from 'socket.io-encrypt';
import path from 'path';
const portfinder = require('portfinder');

class ConsoleChat {
    private nick;
    private readLine;
    private socket;
    private channelKey;
    private host;
    private cryptSecret;

    constructor(host, channel) {
        this.channelKey = channel || 'general';
        this.host = host || 'localhost';
        this.cryptSecret = this.channelKey;
    }

    public init() {
        const self = this;
        const app = express();
        const server = new httpServer.Server(app);
        const ioServer = new SocketIo(server);
        this.socket = socketio.connect(`http://${this.host}:8080`, {'forceNew': true, query: `channelKey=${this.channelKey}`});
        encrypt(this.cryptSecret)(this.socket);
        this.readLine = readline.createInterface(process.stdin, process.stdout);

        this.setUserName();

        this.readLine.on('line', function (line) {
            if (line[0] == "/" && line.length > 1) {
                var cmd = line.match(/[a-z]+\b/)[0];
                var arg = line.substr(cmd.length + 2, line.length);
                self.chatCommand(cmd, arg);

            } else {
                // send chat message
                self.socket.emit('send', {type: 'chat', message: line, nick: self.nick});
                self.readLine.prompt(true);
            }
        });


        self.socket.on(this.channelKey, function (data) {
            var leader;
            if (data.type === 'chat' && data.nick !== self.nick) {
                leader = set("<" + data.nick + "> ", "green");
                self.consoleOut(leader + data.message);
                if (data.message.indexOf('notify') !== -1) {
                    notifier.notify(
                        {
                            title: 'Console',
                            message: '((o))',
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
                self.consoleOut(set(data.message, 'cyan'));
            } else if (data.type === "tell" && data.to === self.nick) {
                leader = set("[" + data.from + "->" + data.to + "]", "red");
                self.consoleOut(leader + data.message);
            } else if (data.type === "emote") {
                self.consoleOut(set(data.message, "cyan"));
            }
        });


        portfinder.basePort = 8080;    // default: 8000
        portfinder.highestPort = 8080; // default: 65535
        portfinder.getPortPromise()
            .then((port) => {
                if (port === 8080) {
                    app.use(express.static('public'));
                    ioServer.use(encrypt(self.cryptSecret));
                    ioServer.on('connection', function (socket) {
                        const currentChannelKey = socket.handshake.query['channelKey'] || 'general';
                        socket.on('send', function (data) {
                            ioServer.sockets.emit(currentChannelKey, data);
                        });
                    });
                    server.listen(8080, function () {
                        // console.log("server running in http://localhost:8080");
                    });
                }
            })
            .catch((err) => {
                // console.log('Port is not available');
            });

    }

    public setUserName(){
        const self= this;
        this.readLine.question("Please enter a nickname: ", function (name) {
            self.nick = name;
            var msg = self.nick + " has joined the chat";
            self.socket.emit('send', {type: 'notice', message: msg, key: self.channelKey});
            self.readLine.prompt(true);
        });
    }

    public consoleOut(msg) {
        // process.stdout.clearLine();
        // process.stdout.cursorTo(0);
        var today = new Date();
        var time = today.getFullYear() + "-" + today.getMonth() + "-" + today.getDate() + "  " + today.getHours() + ":" + today.getMinutes();
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0, null);
        console.log(`[${time}]: ${msg}`);
        this.readLine.prompt(true);
    }

    public chatCommand(cmd, arg) {
        switch (cmd) {
            case 'nick':
                var notice = this.nick + " changed their name to " + arg;
                this.nick = arg;
                this.socket.emit('send', {type: 'notice', message: notice});
                break;

            case 'msg':
                var to = arg.match(/[a-z]+\b/)[0];
                var message = arg.substr(to.length, arg.length);
                this.socket.emit('send', {type: 'tell', message: message, to: to, from: this.nick});
                break;

            case 'me':
                var emote = this.nick + " " + arg;
                this.socket.emit('send', {type: 'emote', message: emote});
                break;

            default:
                this.consoleOut("That is not a valid command.");
        }
    }
}

const argvs = process.argv;
let host;
let channelKey;

if (argvs.indexOf('--host') > 0) {
    host = argvs[argvs.indexOf('--host') + 1];
}

if (argvs.indexOf('--channel') > 0) {
    channelKey = argvs[argvs.indexOf('--channel') + 1];
}
const chatInstance = new ConsoleChat(host, channelKey);
chatInstance.init();
