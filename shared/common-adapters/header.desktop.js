// @flow
import React, {Component} from 'react'
import Text from './text'
import type {Props, DefaultProps} from './header'
import {Icon} from '../common-adapters'
import {globalStyles, globalColors, desktopStyles, platformStyles, collapseStyles} from '../styles'

class Header extends Component<Props> {
  static defaultProps: DefaultProps

  renderDefault() {
    const maybeWindowDraggingStyle = this.props.windowDragging ? desktopStyles.windowDragging : {}
    return (
      <div
        style={collapseStyles([
          styles.container,
          maybeWindowDraggingStyle,
          styles.defaultContainer,
          this.props.style,
        ])}
      >
        {this.props.children}
        {this.props.icon && <Icon type="icon-keybase-logo-24" />}
        <Text type="Body" style={{flex: 1, paddingLeft: 6}}>
          {this.props.title}
        </Text>
        {this.props.onClose && (
          <Icon style={styles.closeIcon} type="iconfont-close" onClick={this.props.onClose} />
        )}
      </div>
    )
  }

  renderStrong() {
    const maybeWindowDraggingStyle = this.props.windowDragging ? desktopStyles.windowDragging : {}
    return (
      <div
        style={collapseStyles([
          styles.container,
          maybeWindowDraggingStyle,
          styles.strongContainer,
          this.props.style,
        ])}
      >
        {this.props.title && (
          <Text
            type="Header"
            backgroundMode="Announcements"
            style={platformStyles({
              common: {flex: 1, ...globalStyles.flexBoxCenter, paddingTop: 6},
              isElectron: {cursor: 'default'},
            })}
          >
            {this.props.title}
          </Text>
        )}
        {this.props.children}
        {this.props.onClose && (
          <Icon style={styles.closeIcon} type="iconfont-close" onClick={this.props.onClose} />
        )}
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
  closeIcon: collapseStyles([desktopStyles.windowDraggingClickable, desktopStyles.clickable]),
  container: collapseStyles([
    globalStyles.flexBoxRow,
    desktopStyles.noSelect,
    {
      paddingLeft: 10,
      paddingRight: 10,
    },
  ]),
  defaultContainer: {
    paddingBottom: 6,
    paddingTop: 6,
  },
  logo: {
    height: 22,
    marginRight: 8,
    width: 22,
  },

  strongContainer: {
    backgroundColor: globalColors.blue,
    paddingBottom: 12,
    paddingTop: 6,
  },
}

export default Header
