/* @flow */

import React, {Component} from 'react'
import Render from './index.render'
import Intro from './forms/intro'
import ErrorText from './error.render'

export default class Login extends Component {
  render () {
    return <Render formComponent={this.props.formComponent}/>
  }

  static parseRoute (currentPath, uri) {
    // Fallback (for debugging)
    let Form = () => <ErrorText currentPath={currentPath} />

    switch (currentPath.get('path')) {
      case 'root':
        Form = () => <Intro/>
        break
    }

    return {
      componentAtTop: {
        component: Login,
        props: {
          formComponent: Form
        }
      },
      parseNextRoute: Login.parseRoute
    }
  }
}

Login.propTypes = {
  formComponent: React.PropTypes.any.isRequired
}
