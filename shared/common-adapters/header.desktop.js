/* @flow */

import React, {Component} from 'react'
import {Icon} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props, DefaultProps} from './header'
import Text from './text'

export default class Header extends Component<DefaultProps, Props, void> {
  static defaultProps: DefaultProps;

  renderDefault () {
    return (
      <div style={{...this.props.style, ...styles.container, ...styles.defaultContainer}}>
        {this.props.children}
        {this.props.icon && <Icon type='logo-24' />}
        <Text type='Body' style={{flex: 1, paddingLeft: 6}}>{this.props.title}</Text>
        {this.props.onClose && (
          <Icon style={styles.closeIcon} type='fa-close' onClick={() => this.props.onClose()} />
        )}
      </div>
    )
  }

  renderStrong () {
    return (
      <div style={{...this.props.style, ...styles.container, ...styles.strongContainer}}>
        <Text type='Header' backgroundMode='Announcements' style={{flex: 1, ...globalStyles.flexBoxCenter, paddingTop: 6, cursor: 'default'}}>{this.props.title}</Text>
        {this.props.onClose && (
          <Icon style={styles.closeIcon} type='fa-close' onClick={() => this.props.onClose()} />
        )}
      </div>
    )
  }

  render () {
    if (this.props.type === 'Default') {
      return this.renderDefault()
    } else if (this.props.type === 'Strong') {
      return this.renderStrong()
    } else {
      return <div />
    }
  }
}

Header.defaultProps = {type: 'Default'}

const styles = {
  container: {
    ...globalStyles.flexBoxRow,
    ...globalStyles.windowDragging,
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
