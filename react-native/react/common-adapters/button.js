import React, {Component, Text, TouchableHighlight, View} from '../base-react'
import commonStyles, {buttonHighlight, disabledButtonHighlight} from '../styles/common'

export default class Button extends Component {
  render () {
    const enabled = this.props.hasOwnProperty('enabled') ? this.props.enabled : true
    const textStyles = [commonStyles.button, this.props.buttonStyle, enabled ? {} : commonStyles.disabledButton]
    const containerStyles = [commonStyles.buttonHighlight, this.props.style]

    const child = this.props.children ? this.props.children : (<Text style={textStyles}>{this.props.title}</Text>)

    return !enabled ? (<View style={containerStyles}>{child}</View>) : (
      <TouchableHighlight
        underlayColor={enabled ? buttonHighlight : disabledButtonHighlight }
        onPress={enabled ? this.props.onPress : null}
        style={containerStyles}>
        {child}
      </TouchableHighlight>
    )
  }
}

Button.propTypes = {
  onPress: React.PropTypes.func.isRequired,
  title: React.PropTypes.string,
  buttonStyle: React.PropTypes.object,
  children: React.PropTypes.object,
  style: React.PropTypes.object,
  enabled: React.PropTypes.any
}
