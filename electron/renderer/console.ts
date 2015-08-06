import ConsoleBuffer = require('./console-buffer');
import ConsoleInput = require('./console-input');
import Log = require('./lib/log');
import React = require('react');
import TypedReact = require('typed-react');

//import configuration = require('./lib/configuration');
//const test = configuration.get('app', 'test');

const D = React.DOM;

interface ConsoleProps {}

interface ConsoleState {
  username: string;
  log: Log;
}

class Console extends TypedReact.Component<ConsoleProps, ConsoleState> {

  getInitialState(): ConsoleState {
    return {
      username: '',
      log: new Log([], '')
    };
  }

  componentDidMount() {
    let ipc = _require('ipc');
    ipc.on('output', this.onOutput);
    ipc.on('error', this.onError);
  }

  render() {
    return (
      D.div({id: 'app-view'},
        ConsoleBuffer({log: this.state.log}),
        ConsoleInput({submit: this.submitInput})
      )
    );
  }

  submitInput(text: string) {
    console.log("Submit: " + text);
    let ipc = _require('ipc');
    ipc.send('command', {text});
  }

  onError(text: string) {
    //console.error(text);
    this.append("Error: " + text);
  }

  onOutput(text: string) {
    //console.log("Output: " + text);
    this.append(text);
  }

  append(text: string) {
    var items = this.state.log.items.concat([text])
    this.state.log = new Log(items, text);
    this.forceUpdate();
  }
}

export = React.createFactory(TypedReact.createClass(Console));
