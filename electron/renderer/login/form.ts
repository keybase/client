import React = require("react");
import TypedReact = require("typed-react");

import AlertView = require("../alert-view");
import LoginStatus = require("./status");

const D = React.DOM;

let ipc = _require("ipc");

class LoginForm extends TypedReact.Component<LoginStatus, {}> {

  submit(e: React.FormEvent) {
    e.preventDefault();
    let username = React.findDOMNode<HTMLInputElement>(this.refs["username"]).value;
    let passphrase = React.findDOMNode<HTMLInputElement>(this.refs["password"]).value;
    //let storeSecret = React.findDOMNode<HTMLInputElement>(this.refs["storeSecret"]).value;
    //console.log("Store secret? ", storeSecret);
    let request = {protocol: "keybase.1.login", method:"loginWithPassphrase", args: {username, passphrase}};
    ipc.send("serviceRequest", request) // Make call to service
  }

  render() {
    return (
      AlertView({alert: this.props.alert}),
      D.form({className: "form-login", onSubmit: this.submit},
        D.h2({className: "form-login-heading"}, "Welcome to Keybase"),
        D.div({className: "form-group"},
          D.label({htmlFor: "inputEmail", }, "Email or Username"),
          D.input({ref: "username", className: "form-control", placeholder:"Email or Username", required: true, autoFocus: true})
        ),
        D.div({className: "form-group"},
          D.label({htmlFor: "inputPassword"}, "Password"),
          D.input({type: "password", className: "form-control", ref: "password", placeholder:"Password", required: true})
        ),
        D.div({className: "checkbox"},
          D.label(null,
            D.input({type: "checkbox", value: "remember-me", ref: "storeSecret"}, "Remember me")
          )
        ),
        D.button({className: "btn btn-primary", type: "submit"}, "Log In")
      )
    );
  }
}

export = React.createFactory(TypedReact.createClass(LoginForm));
