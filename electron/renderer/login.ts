import React = require('react');
import TypedReact = require('typed-react');

import AlertView = require('./alert-view');
import Alert = require('./lib/alert');

const D = React.DOM;

let ipc = _require('ipc');

interface LoginState {
  alert: Alert;
}

class Login extends TypedReact.Component<{}, LoginState> {

  componentDidMount() {
    ipc.on('rpc', this.onResponse);
  }

  getInitialState(): LoginState {
    return {
      alert: null
    }
  }

  submit(e: React.FormEvent) {
    e.preventDefault();
    let username = React.findDOMNode<HTMLInputElement>(this.refs['username']).value;
    let passphrase = React.findDOMNode<HTMLInputElement>(this.refs['password']).value;
    //let storeSecret = React.findDOMNode<HTMLInputElement>(this.refs['storeSecret']).value;
    //console.log('Store secret? ', storeSecret);
    let request = {protocol: 'keybase.1.login', method:'loginWithPassphrase', args: {username, passphrase}};
    ipc.send('rpc', request)
  }

  onResponse(response) {
    console.log('Login response: ', response)
    if (response.err) {
      this.state.alert = {type: 'danger', message: response.err['desc']};
    } else {
      this.state.alert = {type: 'success', message: "Logged in!"};
    }
    this.forceUpdate();
  }

  render() {
    return (
      D.div({className: 'container'},
        D.form({className: 'form-login', onSubmit: this.submit},
          D.h2({className: 'form-login-heading'}, 'Welcome to Keybase'),

          AlertView({alert: this.state.alert}),

          D.div({className: 'form-group'},
            D.label({htmlFor: 'inputEmail', }, 'Email or Username'),
            D.input({ref: 'username', className: 'form-control', placeholder:'Email or Username', required: true, autoFocus: true})
          ),
          D.div({className: 'form-group'},
            D.label({htmlFor: 'inputPassword'}, 'Password'),
            D.input({type: 'password', className: 'form-control', ref: 'password', placeholder:'Password', required: true})
          ),
          D.div({className: 'checkbox'},
            D.label(null,
              D.input({type: 'checkbox', value: 'remember-me', ref: 'storeSecret'}, 'Remember me')
            )
          ),
          D.button({className: 'btn btn-primary', type: 'submit'}, 'Log In')
        )
      )
    );
  }

}

export = React.createFactory(TypedReact.createClass(Login));
