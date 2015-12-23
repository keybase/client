import React, {Component} from '../base-react'
import {globalStyles, globalColors} from '../styles/style-guide'

export default class Text extends Component {
  render () {
    const typeStyle = {
      'Header': styles.textHeader,
      'Body': styles.textBody
    }[this.props.type]

    const style = {
      ...typeStyle,
      ...(this.props.link ? styles.textLinkMixin : {}),
      ...(this.props.small ? styles.textSmallMixin : {}),
      ...(this.props.reversed ? styles.textReversedMixin : {})
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

const textCommon = {
  ...globalStyles.fontRegular,
  ...globalStyles.noSelect,
  color: globalColors.grey1,
  cursor: 'default'
}

export const styles = {
  textHeader: {
    ...textCommon,
    ...globalStyles.fontBold,
    fontSize: 18,
    lineHeight: '22px',
    letterSpacing: '0.5px'
  },
  textBody: {
    ...textCommon,
    fontSize: 15,
    lineHeight: '20px',
    letterSpacing: '0.2px'
  },
  textLinkMixin: {
    color: globalColors.blue,
    cursor: 'pointer'
  },
  textSmallMixin: {
    fontSize: 13,
    lineHeight: '17px'
  },
  textReversedMixin: {
    color: globalColors.white
  }
}
