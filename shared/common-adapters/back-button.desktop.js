// @flow
import React, {Component} from 'react'
import type {Props} from './back-button'
import {Text, Icon} from './index'
import {globalStyles} from '../styles'

class BackButton extends Component<void, Props, void> {
  onClick(event: SyntheticEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (this.props.onClick) {
      this.props.onClick()
    }
  }

  render() {
    return (
      <div style={{...styles.container, ...this.props.style}} onClick={e => this.onClick(e)}>
        <Icon type="iconfont-back" style={{...styles.icon, ...this.props.iconStyle}} />
        {this.props.title !== null &&
          <Text type="BodyPrimaryLink" style={this.props.textStyle} onClick={e => this.onClick(e)}>
            {this.props.title || 'Back'}
          </Text>}
      </div>
    )
  }
}

export const styles = {
  container: {
    ...globalStyles.flexBoxRow,
    ...globalStyles.clickable,
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
  },
}

export default BackButton
