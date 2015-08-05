import AppView = require('./app-view');
import React = require('react');
import TypedReact = require('typed-react');

const D = React.DOM;

interface AppState {}

class App extends TypedReact.Component<{}, AppState> {

  componentDidMount() {}

  render() {
    return AppView();
  }

};

React.render(React.createElement(TypedReact.createClass(App)), document.getElementById('app'));
