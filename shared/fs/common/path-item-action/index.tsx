import * as React from 'react'
import type * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import * as FsGen from '../../../actions/fs-gen'
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
  mode: 'row' | 'screen'
  path: Types.Path
  initView: Types.PathItemActionMenuView
}

const IconClickable = props => (
  <Kb.WithTooltip tooltip="More actions">
    <Kb.Icon
      fixOverdraw={false}
      type="iconfont-ellipsis"
      color={props.actionIconWhite ? Styles.globalColors.whiteOrBlueDark : Styles.globalColors.black_50}
      hoverColor={props.actionIconWhite ? null : Styles.globalColors.black}
      padding="tiny"
      sizeType={props.sizeType || 'Default'}
      onClick={props.onClick}
      ref={props.setRef}
    />
  </Kb.WithTooltip>
)

const PathItemAction = (props: Props) => {
  const dispatch = Container.useDispatch()
  const {initView} = props

  const {setShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <ChooseView
      path={props.path}
      mode={props.mode}
      floatingMenuProps={{
        attachTo,
        containerStyle: styles.floatingContainer,
        hide,
        visible: showingPopup,
      }}
    />
  ))

  const onClick = React.useCallback(() => {
    dispatch(FsGen.createSetPathItemActionMenuView({view: initView}))
    setShowingPopup(true)
  }, [initView, dispatch, setShowingPopup])
  const hide = React.useCallback(() => {
    setShowingPopup(false)
    dispatch(FsGen.createSetPathItemActionMenuDownload({downloadID: null, intent: null}))
  }, [setShowingPopup, dispatch])

  if (props.path === Constants.defaultPath) {
    return null
  }

  // TODO: should probably React.memo this as it's on every row. Would need to
  // do something about the `clickable` prop though, perhaps flattening it.
  return (
    <>
      {props.clickable.type === 'component' && (
        <props.clickable.component onClick={onClick} setRef={popupAnchor as any} />
      )}
      {props.clickable.type === 'icon' && (
        <IconClickable
          onClick={onClick}
          setRef={popupAnchor}
          sizeType={props.clickable.sizeType}
          actionIconWhite={props.clickable.actionIconWhite}
        />
      )}
      {showingPopup && popup}
    </>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      floatingContainer: Styles.platformStyles({
        common: {
          overflow: 'visible',
        },
        isElectron: {
          marginTop: 12,
        },
        isMobile: {
          marginTop: undefined,
        },
      }),
    } as const)
)

export default PathItemAction
