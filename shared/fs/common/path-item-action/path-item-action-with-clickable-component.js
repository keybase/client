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

export type ClickableComponent = React.ComponentType<ClickableProps>

type Props = {|
  clickable: ClickableComponent,
  init: () => void,
  onHidden: () => void,
  path: Types.Path,
  routePath: I.List<string>,
|}

const PathItemActionWithClickableComponent = Kb.OverlayParentHOC((props: Props & Kb.OverlayParentProps) => {
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
      <props.clickable onClick={onClick} setRef={props.setAttachmentRef} />
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

export default PathItemActionWithClickableComponent
