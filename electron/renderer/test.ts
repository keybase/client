import React = require("react");
import TypedReact = require("typed-react");

import AlertView = require("./alert-view");
import Alert = require("./lib/alert");

const D = React.DOM;

let ipc = _require("ipc");

enum TestStep {Intro, Reply, Done};

interface TestState {
  alert: Alert;
  step: TestStep;
}

/**
 This is a test component that tests making and handling service requests.
 It has 3 steps:

 (1) In intro step we submit a keybase.1.test.test request to the service.

 (2) The service requests keybase.1.test.testCallback, so we show the reply step,
 where we ask for user input. When the user submits the reply we send a response
 back to the service.

 (3) The service then responds and we show the last (done) step with the reply.
 */
class Test extends TypedReact.Component<{}, TestState> {

  getInitialState(): TestState {
    return {
      alert: null,
      step: TestStep.Intro
    }
  }

  componentDidMount() {
    ipc.on("serviceRequest", this.onServiceRequest); // Request from service to UI
    ipc.on("serviceResponse", this.onServiceResponse); // Response from service
  }

  submit(e: React.FormEvent) {
    e.preventDefault();
    let request = {protocol: "keybase.1.test", method:"test", args: {name: "Testing"}};
    console.log("Request: ", request);
    ipc.send("serviceRequest", request); // Make call to service
  }

  submitReply(e: React.FormEvent) {
    e.preventDefault();
    let reply = React.findDOMNode<HTMLInputElement>(this.refs["reply"]).value;
    let response = {result: reply};
    ipc.send("responseForService", response); // Response to request from service
  }

  submitReset(e: React.FormEvent) {
    e.preventDefault();
    this.reset();
  }

  sendError(msg: string) {
    let response = {err: msg};
    ipc.send("responseForService", response);
  }

  reset() {
    this.state.step = TestStep.Intro;
    this.state.alert = null;
    this.forceUpdate();
  }

  onServiceRequest(request) {
    let method = request.method;
    let args = request.args;
    console.log("Request from service: ", method, args);
    if (method == "keybase.1.test.testCallback") {
      this.state.step = TestStep.Reply;
    } else {
      this.sendError("Don't know how to handle method: " + method);
    }
    this.forceUpdate();
  }

  onServiceResponse(response) {
    console.log("Response: ", response);
    this.state.step = TestStep.Done;
    let result = response.result;
    if (result.reply) {
      this.state.alert = {type: "success", message: result.reply};
    } else {
      if (response.err) {
        this.state.alert = {type: "danger", message: response.err["desc"]};
      } else {
        this.state.alert = {type: "danger", message: "No response"};
      }
    }
    this.forceUpdate();
  }

  render() {
    if (this.state.step == TestStep.Done) {
      return (
        D.div({className: "container"},
          D.h2({className: "form-test-heading"}, "Done"),
          AlertView({alert: this.state.alert}),
          D.form({className: "form-test", onSubmit: this.submitReset},
            D.button({className: "btn btn-primary", type: "submit"}, "Reset")
          )
        )
      );
    } else if (this.state.step == TestStep.Reply) {
      return (
        D.div({className: "container"},
          AlertView({alert: this.state.alert}),
          D.h2({className: "form-test-heading"}, "Send a Reply"),
          D.form({className: "form-test", onSubmit: this.submitReply},
            D.div({className: "form-group"},
              D.label({htmlFor: "inputReply", }, "Reply"),
              D.input({ref: "reply", className: "form-control", placeholder:"Reply", required: true, autoFocus: true})
            ),
            D.button({className: "btn btn-primary", type: "submit"}, "Reply")
          )
        )
      );
    } else {
      return (
        D.div({className: "container"},
          AlertView({alert: this.state.alert}),
          D.h2({className: "form-test-heading"}, "Test"),
          D.form({className: "form-test", onSubmit: this.submit},
            D.button({className: "btn btn-primary", type: "submit"}, "Start")
          )
        )
      );
    }
  }

}

export = React.createFactory(TypedReact.createClass(Test));
