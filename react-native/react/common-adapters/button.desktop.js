import React, {Component} from '../base-react'
import {FlatButton} from 'material-ui'
import {globalStyles} from '../styles/style-guide'

export default class Button extends Component {
  render () {
    const rootStyle = this.props.primary ? globalStyles.buttonPrimary : globalStyles.buttonSeconary
    return (
      <FlatButton
        style={{...rootStyle, ...this.props.style}}
        labelStyle={globalStyles.buttonLabel}
        label={this.props.label}
        primary={this.props.primary} />
    )
  }
}

Button.propTypes = {
  label: React.PropTypes.string,
  style: React.PropTypes.object,
  primary: React.PropTypes.bool
}
