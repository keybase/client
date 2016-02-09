/* @flow */

import React, {Component} from 'react'
import Form from './form'
import Intro from './forms/intro'
import ErrorText from './error.render'

import SignupRouter from './signup'

// Register Components
import Register from './register'
// import PaperKey from './register/paper-key'

export default class Login extends Component {
  render () {
  }

  static parseRoute (currentPath, uri) {
    // Fallback (for debugging)
    let form = <ErrorText currentPath={currentPath} />

    const path = currentPath.get('path')

    const {component: Component, props} = currentPath.get('parseRoute') || {}
    if (Component) {
      form = <Component {...props}/>
    } else {
      switch (path) {
        case 'root':
          form = <Intro/>
          break
        case 'signup':
          return SignupRouter(currentPath, uri)
        case 'register':
          form = <Register />
          break
      }
    }

    return {
      componentAtTop: {
        component: Form,
        hideBack: true,
        props: {
          formComponent: () => form
        }
      },
      parseNextRoute: Login.parseRoute
    }
  }
}

Login.propTypes = {
  formComponent: React.PropTypes.any.isRequired
}
