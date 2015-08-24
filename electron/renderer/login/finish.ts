import React = require("react");
import TypedReact = require("typed-react");

import LoginStatus = require("./status");
import AlertView = require("../alert-view");

const D = React.DOM;

let ipc = _require("ipc");

class LoginFinish extends TypedReact.Component<LoginStatus, {}> {

  render() {
    return (
      AlertView({alert: this.props.alert}),
      D.h2("Welcome to Keybase")
    );
  }
}

export = React.createFactory(TypedReact.createClass(LoginFinish));
