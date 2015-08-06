import React = require('react');
import TypedReact = require('typed-react');
import Alert = require('./lib/alert');

const D = React.DOM;

class AlertProps {
  alert: Alert;
}

class AlertView extends TypedReact.Component<AlertProps, {}> {

  render() {
    if (this.props.alert == null) return D.div();
    return (
      D.div({className: 'alert alert-' + this.props.alert.type, role: 'alert'}, this.props.alert.message)
    );
  }

}

export = React.createFactory(TypedReact.createClass(AlertView));
