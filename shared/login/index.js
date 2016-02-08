/* @flow */

import React, {Component} from 'react'
import Render from './index.render'
import Intro from './forms/intro'
import ErrorText from './error.render'

// Signup Components
import InviteCode from './signup/inviteCode'
import UsernameEmailForm from './signup/usernameEmailForm'

// Register Components
import Register from './register'
// import PaperKey from './register/paper-key'

export default class Login extends Component {
  render () {
    return <Render formComponent={this.props.formComponent}/>
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
        case 'inviteCode':
          form = <InviteCode/>
          break
        case 'usernameAndEmail':
          form = <UsernameEmailForm/>
          break
        case 'register':
          form = <Register />
          break
      }
    }

    return {
      componentAtTop: {
        component: Login,
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
