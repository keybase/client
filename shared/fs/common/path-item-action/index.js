// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import ChooseView from './choose-view'

type ClickableProps = {|
  onClick: () => void,
  setRef: (?React.Component<any>) => void,
|}

type ClickableComponent = {|
  component: React.ComponentType<ClickableProps>,
  type: 'component',
|}

type ClickableIcon = {|
  actionIconFontSize?: number,
  actionIconWhite?: boolean,
  type: 'icon',
|}

export type Clickable = ClickableComponent | ClickableIcon

type Props = {|
  clickable: Clickable,
  init: () => void,
  onHidden: () => void,
  path: Types.Path,
  routePath: I.List<string>,
|}

const IconClickable = props => (
  <Kb.Icon
    type="iconfont-ellipsis"
    color={props.actionIconWhite ? Styles.globalColors.white : Styles.globalColors.black_50}
    hoverColor={props.actionIconWhite ? null : Styles.globalColors.black}
    style={Kb.iconCastPlatformStyles(styles.actionIcon)}
    fontSize={props.actionIconFontSize}
    onClick={props.onClick}
    ref={props.setRef}
  />
)

const PathItemAction = Kb.OverlayParentHOC((props: Props & Kb.OverlayParentProps) => {
  const hideMenuOnce = (() => {
    let hideMenuCalled = false
    return () => {
      if (hideMenuCalled) {
        return
      }
      hideMenuCalled = true
      props.toggleShowingMenu()
      props.onHidden()
    }
  })()

  const onClick = () => {
    props.init()
    props.toggleShowingMenu()
  }

  return (
    <>
      {props.clickable.type === 'component' && (
        <props.clickable.component onClick={onClick} setRef={props.setAttachmentRef} />
      )}
      {props.clickable.type === 'icon' && (
        <IconClickable
          onClick={onClick}
          setRef={props.setAttachmentRef}
          actionIconFontSize={props.clickable.actionIconFontSize}
          actionIconWhite={props.clickable.actionIconWhite}
        />
      )}
      {props.showingMenu && (
        <ChooseView
          path={props.path}
          routePath={props.routePath}
          floatingMenuProps={{
            attachTo: props.getAttachmentRef,
            containerStyle: styles.floatingContainer,
            hideOnce: hideMenuOnce,
            visible: props.showingMenu,
          }}
        />
      )}
    </>
  )
})

const styles = Styles.styleSheetCreate({
  actionIcon: {
    padding: Styles.globalMargins.tiny,
  },
  floatingContainer: Styles.platformStyles({
    common: {
      overflow: 'visible',
    },
    isElectron: {
      marginTop: 12,
      width: 220,
    },
    isMobile: {
      marginTop: undefined,
      width: '100%',
    },
  }),
})

export default PathItemAction
