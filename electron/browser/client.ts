
var rpc = require('framed-msgpack-rpc');

// This doesn't work?
//rpc.log.set_default_level(rpc.log.levels.DEBUG);

interface Request {
  protocol: string;
  method: string;
  args;
}

interface Response {
  err;
  result;
}

interface Responder {
  (response: Response);
}

class Client {
  transport;
  sessionId: number;

  connect(path: string, responder: Responder) {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
    this.sessionId = 1;

    this.transport = rpc.createTransport({path: path, robust: true});

    /*
    this.transport.add_handler('keybase.1.secretUi.getSecret', function(r) {
      console.log("Handle: ", r);
    });

    this.transport.add_handler('keybase.1.locksmithUi.promptDeviceName', function(r) {
      console.log("promptDeviceName: ", r);
    });
    */

    this.transport.connect(function (err) {
      responder({err: err, result: null});
    });
  }

  invoke(request: Request, responder: Responder) {
    var client = new rpc.Client(this.transport, request.protocol);
    request.args['sessionID'] = ++this.sessionId;
    client.invoke(request.method, [request.args], function(err, res) {
      responder({err: err, result: res});
    });
  }

  run(command: string, responder: Responder) {

    var cmdArgs = command.split(/\s*[\s,]\s*/);
    var cmd = cmdArgs.shift();

    var protocol = null;
    var method = null;
    var args = {};
    if (cmd == 'id') {
      protocol = 'keybase.1.identify';
      method = 'identify';
      if (cmdArgs.length < 1) {
        let err = {err: {desc: 'No user specified'}};
        responder({err: err, result: null});
        return;
      }
      args['userAssertion'] = cmdArgs.shift();
    } else {
      let err = {err: {desc: 'Command not found: ' + cmd}};
      responder({err: err, result: null});
      return;
    }

    var request = {protocol, method, args};
    this.invoke(request, responder);
  }
}

export = Client;


