import * as React from 'react'
import * as Kb from '@/common-adapters'

export type HeaderType = 'Default' | 'Strong'
export type Props = {
  icon?: boolean
  title?: string
  onClose?: () => void
  style?: object
  children?: React.ReactNode
  windowDragging?: boolean
  type?: HeaderType
}

class DragHeader extends React.Component<Props> {
  renderDefault() {
    const maybeWindowDraggingStyle =
      this.props.windowDragging ?? true ? Kb.Styles.desktopStyles.windowDragging : {}
    return (
      <div
        style={
          Kb.Styles.collapseStyles([
            styles.container,
            maybeWindowDraggingStyle,
            styles.defaultContainer,
            this.props.style,
          ]) as React.CSSProperties
        }
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
    const maybeWindowDraggingStyle =
      this.props.windowDragging ?? true ? Kb.Styles.desktopStyles.windowDragging : {}
    return (
      <div
        style={
          Kb.Styles.collapseStyles([
            styles.container,
            maybeWindowDraggingStyle,
            styles.strongContainer,
            this.props.style,
          ]) as React.CSSProperties
        }
      >
        {this.props.title && (
          <Kb.Text
            type="Header"
            negative={true}
            style={Kb.Styles.platformStyles({
              common: {flex: 1, ...Kb.Styles.globalStyles.flexBoxCenter, paddingTop: 6},
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
    if ((this.props.type ?? 'Default') === 'Default') {
      return this.renderDefault()
    } else {
      return this.renderStrong()
    }
  }
}

const styles = {
  closeIcon: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.desktopStyles.windowDraggingClickable,
      ...Kb.Styles.desktopStyles.clickable,
    },
  }),
  container: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      ...Kb.Styles.desktopStyles.noSelect,
      paddingLeft: 10,
      paddingRight: 10,
    },
  }),
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
    backgroundColor: Kb.Styles.globalColors.blue,
    paddingBottom: 12,
    paddingTop: 6,
  },
}

export default DragHeader
