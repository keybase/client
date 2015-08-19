import React = require('react');
import TypedReact = require('typed-react');

import AlertView = require('./alert-view');
import Alert = require('./lib/alert');

const D = React.DOM;

let ipc = _require('ipc');

interface TestState {
  alert: Alert;
}

class Test extends TypedReact.Component<{}, TestState> {

  componentDidMount() {
    ipc.on('response', this.onResponse); // Response from service
    ipc.on('request', this.onRequest); // Request from service to UI
  }

  getInitialState(): TestState {
    return {      
      alert: null
    }
  }

  submit(e: React.FormEvent) {
    e.preventDefault();

    let request = {protocol: 'keybase.1.ctl', method:'test', args: {name: "Testing"}};

    ipc.send('request', request) // Make call to service
  }

  onRequest(request) {
    let method = request.method;
    let arg = request.arg;
    console.log('Request from main: ', method, arg);
    let response = {result: "string from renderer (Test)"}
    ipc.send('response', response); // Response to service request
  }

  onResponse(response) {
    let result = response.result;
    console.log('Response: ', result, response.err);
    if (result.result) {
      this.state.alert = {type: 'success', message: "Test OK! " + result.result};
    } else {
      if (response.err) {
        this.state.alert = {type: 'danger', message: response.err['desc']};
      } else {
        this.state.alert = {type: 'danger', message: 'No response'};
      }
    }
    this.forceUpdate();
  }

  render() {
    return (
      D.div({className: 'container'},
        D.form({className: 'form-test', onSubmit: this.submit},
          D.h2({className: 'form-test-heading'}, 'Test'),

          AlertView({alert: this.state.alert}),

          D.button({className: 'btn btn-primary', type: 'submit'}, 'Test')
        )
      )
    );
  }

}

export = React.createFactory(TypedReact.createClass(Test));
