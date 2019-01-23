// @flow
import React, {Component} from 'react'
import type {Props} from './back-button'
import Text from './text'
import Icon from './icon'
import {globalStyles, desktopStyles, collapseStyles} from '../styles'

class BackButton extends Component<Props> {
  _onClick = (event: SyntheticEvent<>) => {
    event.preventDefault()
    event.stopPropagation()
    if (this.props.onClick) {
      this.props.onClick()
    }
  }

  render() {
    return (
      <div
        style={collapseStyles([
          this.props.onClick ? styles.container : styles.disabledContainer,
          this.props.style,
        ])}
        onClick={this._onClick}
      >
        <Icon
          type="iconfont-arrow-left"
          style={this.props.onClick ? styles.icon : styles.disabledIcon}
          color={this.props.iconColor}
        />
        {this.props.title !== null && !this.props.hideBackLabel && (
          <Text
            type={this.props.onClick ? 'BodyPrimaryLink' : 'Body'}
            style={collapseStyles([!!this.props.onClick && styles.disabledText, this.props.textStyle])}
            onClick={this.props.onClick ? this._onClick : null}
          >
            {this.props.title || 'Back'}
          </Text>
        )}
      </div>
    )
  }
}

export const styles = {
  container: {
    ...globalStyles.flexBoxRow,
    ...desktopStyles.clickable,
    alignItems: 'center',
    zIndex: 1,
  },
  disabledContainer: {
    ...globalStyles.flexBoxRow,
    cursor: 'default',
    alignItems: 'center',
    zIndex: 1,
  },
  disabledIcon: {
    cursor: 'default',
    marginRight: 6,
  },
  disabledText: {
    cursor: 'default',
  },
  icon: {
    marginRight: 6,
  },
}

export default BackButton
