/* @flow */

import React, {Component} from 'react'
import Render from './form.render'
import Intro from './forms/intro'
import ErrorText from './error.render'

export default class Form extends Component {
  props: {
    formComponent: ReactClass
  };

  render () {
    return <Render formComponent={this.props.formComponent}/>
  }
}

Form.propTypes = {
  formComponent: React.PropTypes.any.isRequired
}
