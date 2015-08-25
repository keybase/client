
var rpc = require('framed-msgpack-rpc');

import ipc = require('ipc');

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
  window;
  sessionId: number;

  constructor(window) {
    this.window = window;
    this.registerIPC();
  }

  registerIPC() {
    let client = this;
    ipc.on('serviceRequest', function(event, request) {
      console.log('Service request: ', request);
      client.invoke(request, event, function(response) {
        console.log('Service response: ', response);
        event.sender.send('serviceResponse', response);
      });
    });
  }

  connect(path: string, responder: Responder) {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
    this.sessionId = 1;

    this.transport = rpc.createTransport({path: path, robust: true});

    let client = this;
    this.transport.set_generic_handler(function(request) {
      //console.log("Handler: ", request);
      client.serviceRequestForRenderer(request.method, request.param, request.response);
    });

    this.transport.connect(function (err) {
      responder({err: err, result: null});
    });
  }

  invoke(request: Request, event, responder: Responder) {
    let rpcClient = new rpc.Client(this.transport, request.protocol);
    request.args['sessionID'] = ++this.sessionId;
    rpcClient.invoke(request.method, [request.args], function(err, res) {
      responder({err: err, result: res});
    });
  }

  serviceRequestForRenderer(method, arg, response) {
    ipc.on('responseForService', function(event, request) {
      console.log('Response for service: ', request);
      response.result(request.result);
    });

    let serviceArgs = arg[0];
    console.log("Service request for renderer: ", method, serviceArgs);
    this.window.webContents.send('serviceRequest', {method, args: serviceArgs});
  }

}

export = Client;
