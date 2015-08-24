import React = require("react");
import TypedReact = require("typed-react");

import AlertView = require("../alert-view");
import LoginStatus = require("./status");

const D = React.DOM;

let ipc = _require("ipc");

class DevicePrompt extends TypedReact.Component<LoginStatus, {}> {

  submit(e: React.FormEvent) {
    e.preventDefault();
    let name = React.findDOMNode<HTMLInputElement>(this.refs["name"]).value;
    let response = {result: name};
    ipc.send("responseForService", response);
  }

  render() {
    return (
      AlertView({alert: this.props.alert}),
      D.form({className: "form", onSubmit: this.submit},
        D.h2({className: "form-heading"}, "Set a Device Name"),
        D.div({className: "form-group"},
          D.p("This is the first time you've logged into this device. You need to register this device by choosing a name. For example, Macbook or Desktop."),
          D.input({ref: "name", className: "form-control", placeholder:"Device Name", required: true, autoFocus: true})
        ),
        D.button({className: "btn btn-default", type: "button"}, "Cancel"),
        D.button({className: "btn btn-primary", type: "submit"}, "Save")
      )
    );
  }
}

export = React.createFactory(TypedReact.createClass(DevicePrompt));
