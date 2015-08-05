import _ = require('underscore');
import BufferView = require('./buffer-view');
import configuration = require('./lib/configuration');
import InputBox = require('./input-box');
import Log = require('./lib/log');
import React = require('react');
import TypedReact = require('typed-react');

const D = React.DOM;

//const test = configuration.get('app', 'test');

interface AppViewProps {}

interface AppViewState {
  username: string;
  log: Log;
}

class AppView extends TypedReact.Component<AppViewProps, AppViewState> {

  getInitialState(): AppViewState {
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
        BufferView({log: this.state.log}),
        InputBox({submit: this.submitInput})
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

export = React.createFactory(TypedReact.createClass(AppView));
