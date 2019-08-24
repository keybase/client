import React, {Component} from 'react'
import Text from './text'
import {Props} from './header'
import Icon from './icon'
import * as Styles from '../styles'

const Kb = {
  Icon,
  Text,
}

class Header extends Component<Props> {
  defaultProps = {type: 'Default', windowDragging: true}

  renderDefault() {
    const maybeWindowDraggingStyle = this.props.windowDragging ? Styles.desktopStyles.windowDragging : {}
    return (
      <div
        style={Styles.collapseStyles([
          styles.container,
          maybeWindowDraggingStyle,
          styles.defaultContainer,
          this.props.style,
        ])}
      >
        {this.props.children}
        {this.props.icon && <Kb.Icon type="icon-keybase-logo-24" />}
        <Kb.Text type="Body" style={{flex: 1, paddingLeft: 6}}>
          {this.props.title}
        </Kb.Text>
        {this.props.onClose && (
          <Kb.Icon style={styles.closeIcon} type="iconfont-close" onClick={this.props.onClose} />
        )}
      </div>
    )
  }

  renderStrong() {
    const maybeWindowDraggingStyle = this.props.windowDragging ? Styles.desktopStyles.windowDragging : {}
    return (
      <div
        style={Styles.collapseStyles([
          styles.container,
          maybeWindowDraggingStyle,
          styles.strongContainer,
          this.props.style,
        ])}
      >
        {this.props.title && (
          <Kb.Text
            type="Header"
            negative={true}
            style={Styles.platformStyles({
              common: {flex: 1, ...Styles.globalStyles.flexBoxCenter, paddingTop: 6},
              isElectron: {cursor: 'default'},
            })}
          >
            {this.props.title}
          </Kb.Text>
        )}
        {this.props.children}
        {this.props.onClose && (
          <Kb.Icon style={styles.closeIcon} type="iconfont-close" onClick={this.props.onClose} />
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

const styles = {
  closeIcon: Styles.collapseStyles([
    Styles.desktopStyles.windowDraggingClickable,
    Styles.desktopStyles.clickable,
  ]),
  container: Styles.collapseStyles([
    Styles.globalStyles.flexBoxRow,
    Styles.desktopStyles.noSelect,
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
    backgroundColor: Styles.globalColors.blue,
    paddingBottom: 12,
    paddingTop: 6,
  },
}

export default Header
