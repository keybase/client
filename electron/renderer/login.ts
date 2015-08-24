import React = require("react");
import TypedReact = require("typed-react");

import AlertView = require("./alert-view");
import Alert = require("./lib/alert");

const D = React.DOM;

import LoginForm = require("./login/form");
import DevicePrompt = require("./login/device_prompt");
import LoginFinish = require("./login/finish");
import LoginStatus = require("./login/status")

let ipc = _require("ipc");

enum LoginStep {Form, DevicePrompt, Finish};

interface LoginState {
  status: LoginStatus;
  step: LoginStep;
}

class Login extends TypedReact.Component<{}, LoginState> {

  componentDidMount() {
    ipc.on("serviceRequest", this.onServiceRequest); // Request from service to UI
    ipc.on("serviceResponse", this.onServiceResponse); // Response from service
  }

  getInitialState(): LoginState {
    return {
      status: null,
      step: LoginStep.Form
    }
  }

  sendError(msg: string) {
    let response = {err: msg};
    ipc.send("responseForService", response);
  }

  reset() {
    this.state.step = LoginStep.Form;
    this.state.status = null;
    this.forceUpdate();
  }

  onServiceRequest(request) {
    let method = request.method;
    let args = request.args;
    console.log("Request from main: ", method, args);
    if (method == "keybase.1.locksmithUi.promptDeviceName") {
      this.state.step = LoginStep.DevicePrompt;
    // TODO: keybase.1.locksmithUi.selectSigner
    }  else {
      this.sendError("Don't know how to handle method: " + method);
    }
    this.forceUpdate();
  }

  onServiceResponse(response) {
    let result = response.result;
    if (response.err) {
      this.state.step = LoginStep.Form;
      this.state.status = {alert: {type: "danger", message: response.err["desc"]}};
    } else {
      this.state.step = LoginStep.Finish;
      this.state.status = {alert: {type: "success", message: "Logged in!"}};
    }
    this.forceUpdate();
  }

  render() {
    var step = null;
    switch (this.state.step) {
      case LoginStep.Form: step = LoginForm(this.state.status); break;
      case LoginStep.DevicePrompt: step = DevicePrompt(this.state.status); break;
      case LoginStep.Finish: step = LoginFinish(this.state.status); break;
    };
    return (
      D.div({className: "container"},
        step
      )
    );
  }

}

export = React.createFactory(TypedReact.createClass(Login));
