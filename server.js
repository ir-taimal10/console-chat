var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.use(express.static('public'));

app.get('/hello', function (req, res) {
    res.status(200).send("Hello World!");
});

io.on('connection', function (socket) {
    var channelKey = socket.handshake.query['channelKey'] || 'general';
    console.log('userKey', channelKey);
    //if (['joe123', 'jane123', 'mary123'].includes(channelKey)) {
    socket.on('send', function (data) {
        io.sockets.emit(channelKey, data);
    });
    //}
});
server.listen(8080, function () {
    console.log("server running in http://localhost:8080");
});
