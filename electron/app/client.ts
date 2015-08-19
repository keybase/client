
var rpc = require('framed-msgpack-rpc');

import ipc = require('ipc');

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

  constructor() {
    this.registerIPC();
  }

  registerIPC() {
    let client = this;
    // renderer -> main -> service -> main -> renderer
    ipc.on('request', function(event, request) {
      console.log('Request from renderer: ', request);
      client.invoke(request, event, function(response) {
        console.log('Sending response to renderer: ', response);
        event.sender.send('response', response);
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

    this.transport.connect(function (err) {
      responder({err: err, result: null});
    });
  }

  invoke(request: Request, event, responder: Responder) {
    let rpcClient = new rpc.Client(this.transport, request.protocol);
    request.args['sessionID'] = ++this.sessionId;

    let client = this;
    let method:string = request.protocol + "." + request.method;

    // For testing only
    // client.transport.add_program('keybase.1.ctl', {
    //   'testCallback': function(transportArg, transportResponse) {
    //     client.sendToRenderer('testCallback', transportArg[0], event, transportResponse);
    //   }}
    // );

    client.transport.add_program('keybase.1.locksmithUi', {
      'promptDeviceName': function(transportArg, transportResponse) {
        client.sendToRenderer('promptDeviceName', transportArg[0], event, transportResponse);
      }}
    );

    rpcClient.invoke(request.method, [request.args], function(err, res) {
      responder({err: err, result: res});
    });
  }

  sendToRenderer(method, arg, event, transportResponse) {
    ipc.on('response', function(event, request) {
      console.log('Response from renderer: ', request);
      transportResponse.result(request.result);
    });

    console.log("Service request to renderer: ", method, arg);
    event.sender.send('request', {method, arg});
  }

  // invoke2(request: Request) {
  //   let client = this;
  //   let rpcClient = new rpc.Client(this.transport, request.protocol);
  //   request.args['sessionID'] = ++this.sessionId;
  //   rpcClient.invoke(request.method, [request.args], function(err, res) {
  //     let response:Response = {err: err, result: res};
  //     client.window.webContents.send('response', response);
  //   });
  // }

  // Console command (not working yet)
  // ipc.on('command', function(event, arg) {
  //   event.sender.send('output', 'Running: ' + arg.text);
  //
  //   client.runCommand(arg.text, event, function(res) {
  //     if (res.err != null) {
  //       event.sender.send('error', res.err.desc);
  //     }
  //     if (res.result != null) {
  //       event.sender.send('output', JSON.stringify(res.result, null, 2));
  //     }
  //   });
  // });

  // // For running commands from the console
  // runCommand(command: string, event, responder: Responder) {
  //
  //   var cmdArgs = command.split(/\s*[\s,]\s*/);
  //   var cmd = cmdArgs.shift();
  //
  //   var protocol = null;
  //   var method = null;
  //   var args = {};
  //   if (cmd == 'id') {
  //     protocol = 'keybase.1.identify';
  //     method = 'identify';
  //     if (cmdArgs.length < 1) {
  //       let err = {err: {desc: 'No user specified'}};
  //       responder({err: err, result: null});
  //       return;
  //     }
  //     args['userAssertion'] = cmdArgs.shift();
  //   } else {
  //     let err = {err: {desc: 'Command not found: ' + cmd}};
  //     responder({err: err, result: null});
  //     return;
  //   }
  //
  //   var request = {protocol, method, args};
  //   this.invoke(request, event, responder);
  // }
}

export = Client;
