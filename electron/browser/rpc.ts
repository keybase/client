
var rpc = require('framed-msgpack-rpc');

interface Response {
  (err, response);
}

class RPC {
  transport;
  sessionId: number;

  connect(path: string, response: Response) {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
    this.sessionId = 1;

    this.transport = rpc.createTransport({path: path, robust: true});
    this.transport.connect(function (err) {
      response(err, null);
    });
  }

  run(command: string, response: Response) {

    var args = command.split(/\s*[\s,]\s*/);
    var cmd = args.shift();

    var invokeArgs = {};
    invokeArgs['sessionID'] = ++this.sessionId;

    var protocol = null;
    var method = null;
    if (cmd == 'id') {
      protocol = 'keybase.1.identify';
      method = 'identify';
      if (args.length < 1) {
        response({desc: 'No user specified'}, null);
        return;
      }
      invokeArgs['userAssertion'] = args.shift();
    } else {
      response({desc: 'Command not found: ' + cmd}, null);
      return;
    }

    var client = new rpc.Client(this.transport, protocol);
    console.log(method);
    console.log(invokeArgs);
    client.invoke(method, [invokeArgs], function(err, res) {
      response(err, res);
    });
  }
}

export = RPC;


