/* @flow */

import React, {Component} from 'react'
import Render from './index.render'
import Intro from './forms/intro'
import {Text} from '../common-adapters'

export default class Login extends Component {
  render () {
    return <Render formComponent={this.props.formComponent}/>
  }

  static parseRoute (currentPath, uri) {
    // Fallback (for debugging)
    let Form = () => <Text type='Body'>Error loading component {JSON.stringify(currentPath.toJS())}</Text>

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
