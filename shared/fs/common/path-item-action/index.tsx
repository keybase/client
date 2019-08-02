import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import ChooseView from './choose-view'

type SizeType = any
// TODO: replace this when common adapters is TS
// import { SizeType } from '../../../common-adapters/icon';

type ClickableProps = {
  onClick: () => void
  setRef: (arg0: React.Component<any> | null) => void
}

type ClickableComponent = {
  component: React.ComponentType<ClickableProps>
  type: 'component'
}

type ClickableIcon = {
  actionIconWhite?: boolean
  sizeType?: SizeType | null
  type: 'icon'
}

export type Clickable = ClickableComponent | ClickableIcon

export type Props = {
  clickable: Clickable
  init: () => void
  mode: 'row' | 'screen'
  onHidden: () => void
  path: Types.Path
}

const IconClickable = props => (
  <Kb.WithTooltip text="More actions">
    <Kb.Icon
      type="iconfont-ellipsis"
      color={props.actionIconWhite ? Styles.globalColors.white : Styles.globalColors.black_50}
      hoverColor={props.actionIconWhite ? null : Styles.globalColors.black}
      padding="tiny"
      sizeType={props.sizeType || 'Default'}
      onClick={props.onClick}
      ref={props.setRef}
    />
  </Kb.WithTooltip>
)

const PathItemAction = Kb.OverlayParentHOC((props: Props & Kb.OverlayParentProps) => {
  if (props.path === Constants.defaultPath) {
    return null
  }

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
          sizeType={props.clickable.sizeType}
          actionIconWhite={props.clickable.actionIconWhite}
        />
      )}
      {props.showingMenu && (
        <ChooseView
          path={props.path}
          mode={props.mode}
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
