import React, {Component} from '../base-react'
import {globalStyles} from '../styles/style-guide'

export default class Text extends Component {
  render () {
    const typeStyle = {
      'Header': globalStyles.textHeader,
      'Body': globalStyles.textBody
    }[this.props.type]

    const style = {
      ...typeStyle,
      ...(this.props.link ? globalStyles.textLinkMixin : {}),
      ...(this.props.small ? globalStyles.textSmallMixin : {}),
      ...(this.props.reversed ? globalStyles.textReversedMixin : {})
    }

    return (
      <div>
        <p className={this.props.link ? 'hover-underline' : ''} style={style}>{this.props.children}</p>
      </div>
    )
  }
}

Text.propTypes = {
  type: React.PropTypes.oneOf(['Header', 'Body']),
  link: React.PropTypes.bool,
  small: React.PropTypes.bool,
  reversed: React.PropTypes.bool,
  children: React.PropTypes.node
}
