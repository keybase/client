import React, {Component} from 'react'
import {Props} from './back-button'
import Text from './text'
import Icon from './icon'
import * as Styles from '../styles'

class BackButton extends Component<Props> {
  _onClick = (event: React.BaseSyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (this.props.onClick) {
      this.props.onClick()
    }
  }

  render() {
    return (
      <div
        style={Styles.collapseStyles([
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
            style={Styles.collapseStyles([!!this.props.onClick && styles.disabledText, this.props.textStyle])}
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
    ...Styles.globalStyles.flexBoxRow,
    ...Styles.desktopStyles.clickable,
    alignItems: 'center',
    zIndex: 1,
  },
  disabledContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      cursor: 'default',
      zIndex: 1,
    },
  }),
  disabledIcon: Styles.platformStyles({
    isElectron: {
      cursor: 'default',
      marginRight: 6,
    },
  }),
  disabledText: Styles.platformStyles({
    isElectron: {cursor: 'default'},
  }),
  icon: {
    marginRight: 6,
  },
}

export default BackButton
