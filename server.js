const WebSocket = require('ws');
const Redis = require('ioredis');

const redis = new Redis({ host: 'redis' });
const wss = new WebSocket.Server({ port: 7379 });

wss.on('connection', function connection(ws) {
  let isServer = false;
  let remoteIp = ws._socket.remoteAddress.replace(/^.*:/, '');

  ws.on('close', function close() {
    if (isServer) {
      redis.get('server', function (err, result) {
        if (!err && result && result == remoteIp) {
          redis.set('server', null);

          console.log('server stopped: %s', remoteIp);
        }
      });
    }
  });

  ws.on('message', function incoming(payload) {
    let json = JSON.parse(payload);
    let message = json.message;
    let type = json.type;

    switch (type) {
      // message: { query: server }
      case 'lookup': {
        redis.get('server', function (err, result) {
          ws.send(JSON.stringify({
            version: 1,
            type: 'lookup',
            message: {
              ip: err || result == null ? '' : result
            }
          }));
        });
      } break;

      // message: { status: online || offline }
      case 'status': {
        if (message.status == 'online') {
          redis.set('server', remoteIp);
          isServer = true;

          console.log('server started: %s', remoteIp);
        }
        else {
          redis.set('server', null);
        }
      } break;
      
      // message: { server: ip, id: Asteroid, params: [0, 1, 2] }
      case 'spawn': {
        redis.get('server', function (err, result) {
          if (!err && result) {
            wss.clients.forEach(client => {
              let clientIp = client._socket.remoteAddress.replace(/^.*:/, '');
              if (result == clientIp) {
                client.send({
                  version: 1,
                  type: 'spawn',
                  message: {
                    id: message.id,
                    params: message.params || []
                  }
                });
              }
            });
          }
        });
      } break;
    }

    console.log('received: %s', JSON.stringify(json));
  });
});