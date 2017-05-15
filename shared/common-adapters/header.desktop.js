// @flow
import React, {Component} from 'react'
import Text from './text'
import type {Props, DefaultProps} from './header'
import {Icon} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'

class Header extends Component<DefaultProps, Props, void> {
  static defaultProps: DefaultProps

  renderDefault() {
    const maybeWindowDraggingStyle = this.props.windowDragging ? globalStyles.windowDragging : {}
    return (
      <div
        style={{
          ...styles.container,
          ...maybeWindowDraggingStyle,
          ...styles.defaultContainer,
          ...this.props.style,
        }}
      >
        {this.props.children}
        {this.props.icon && <Icon type="icon-keybase-logo-24" />}
        <Text type="Body" style={{flex: 1, paddingLeft: 6}}>
          {this.props.title}
        </Text>
        {this.props.onClose &&
          <Icon style={styles.closeIcon} type="iconfont-close" onClick={this.props.onClose} />}
      </div>
    )
  }

  renderStrong() {
    const maybeWindowDraggingStyle = this.props.windowDragging ? globalStyles.windowDragging : {}
    return (
      <div
        style={{
          ...styles.container,
          ...maybeWindowDraggingStyle,
          ...styles.strongContainer,
          ...this.props.style,
        }}
      >
        {this.props.title &&
          <Text
            type="Header"
            backgroundMode="Announcements"
            style={{
              flex: 1,
              ...globalStyles.flexBoxCenter,
              paddingTop: 6,
              cursor: 'default',
            }}
          >
            {this.props.title}
          </Text>}
        {this.props.children}
        {this.props.onClose &&
          <Icon style={styles.closeIcon} type="iconfont-close" onClick={this.props.onClose} />}
      </div>
    )
  }

  render() {
    if (this.props.type === 'Default') {
      return this.renderDefault()
    } else if (this.props.type === 'Strong') {
      return this.renderStrong()
    } else {
      return <div />
    }
  }
}

Header.defaultProps = {type: 'Default', windowDragging: true}

const styles = {
  container: {
    ...globalStyles.flexBoxRow,
    ...globalStyles.noSelect,
    paddingLeft: 10,
    paddingRight: 10,
  },
  logo: {
    width: 22,
    height: 22,
    marginRight: 8,
  },
  defaultContainer: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  strongContainer: {
    backgroundColor: globalColors.blue,
    paddingTop: 6,
    paddingBottom: 12,
  },

  closeIcon: {
    ...globalStyles.windowDraggingClickable,
    ...globalStyles.clickable,
  },
}

export default Header
