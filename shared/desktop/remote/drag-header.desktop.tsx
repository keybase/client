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

const DragHeader = (props: Props) => {
  const renderDefault = () => {
    const maybeWindowDraggingStyle =
      (props.windowDragging ?? true) ? Kb.Styles.desktopStyles.windowDragging : {}
    return (
      <div
        style={
          Kb.Styles.collapseStyles([
            styles.container,
            maybeWindowDraggingStyle,
            styles.defaultContainer,
            props.style,
          ]) as React.CSSProperties
        }
      >
        {props.children}
        {props.icon && <Kb.Icon type="icon-keybase-logo-24" />}
        <Kb.Text type="Body" style={{flex: 1, paddingLeft: 6}}>
          {props.title}
        </Kb.Text>
        {props.onClose && <Kb.Icon style={styles.closeIcon} type="iconfont-close" onClick={props.onClose} />}
      </div>
    )
  }

  const renderStrong = () => {
    const maybeWindowDraggingStyle =
      (props.windowDragging ?? true) ? Kb.Styles.desktopStyles.windowDragging : {}
    return (
      <div
        style={
          Kb.Styles.collapseStyles([
            styles.container,
            maybeWindowDraggingStyle,
            styles.strongContainer,
            props.style,
          ]) as React.CSSProperties
        }
      >
        {props.title && (
          <Kb.Text
            type="Header"
            negative={true}
            style={Kb.Styles.platformStyles({
              common: {flex: 1, ...Kb.Styles.globalStyles.flexBoxCenter, paddingTop: 6},
              isElectron: {cursor: 'default'},
            })}
          >
            {props.title}
          </Kb.Text>
        )}
        {props.children}
        {props.onClose && <Kb.Icon style={styles.closeIcon} type="iconfont-close" onClick={props.onClose} />}
      </div>
    )
  }

  if ((props.type ?? 'Default') === 'Default') {
    return renderDefault()
  } else {
    return renderStrong()
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
