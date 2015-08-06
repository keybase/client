import React = require('react');
import TypedReact = require('typed-react');

import Login = require('./login');
//import ConsoleView = require('./app-view');

const D = React.DOM;

interface AppState {}

class App extends TypedReact.Component<{}, AppState> {

  componentDidMount() {}

  render() {
    return Login();
    //return ConsoleView();
  }

};

React.render(React.createElement(TypedReact.createClass(App)), document.getElementById('app'));
