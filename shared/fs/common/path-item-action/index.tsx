import * as React from 'react'
import type * as T from '../../../constants/types'
import * as C from '../../../constants'
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
  sizeType?: SizeType
  type: 'icon'
}

export type Clickable = ClickableComponent | ClickableIcon

export type Props = {
  clickable: Clickable
  mode: 'row' | 'screen'
  path: T.FS.Path
  initView: T.FS.PathItemActionMenuView
}

const IconClickable = (props: any) => (
  <Kb.WithTooltip tooltip="More actions">
    <Kb.Icon
      fixOverdraw={false}
      type="iconfont-ellipsis"
      color={props.actionIconWhite ? Styles.globalColors.whiteOrBlueDark : Styles.globalColors.black_50}
      hoverColor={props.actionIconWhite ? undefined : Styles.globalColors.black}
      padding="tiny"
      sizeType={props.sizeType || 'Default'}
      onClick={props.onClick}
      ref={props.setRef}
    />
  </Kb.WithTooltip>
)

const PathItemAction = (props: Props) => {
  const {initView, path, mode} = props
  const setPathItemActionMenuDownload = C.useFSState(s => s.dispatch.setPathItemActionMenuDownload)
  const setPathItemActionMenuView = C.useFSState(s => s.dispatch.setPathItemActionMenuView)

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p

      const hide = () => {
        toggleShowingPopup()
        setPathItemActionMenuDownload()
      }

      return (
        <ChooseView
          path={path}
          mode={mode}
          floatingMenuProps={{
            attachTo,
            containerStyle: styles.floatingContainer,
            hide,
            visible: true,
          }}
        />
      )
    },
    [setPathItemActionMenuDownload, path, mode]
  )
  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  const onClick = React.useCallback(() => {
    setPathItemActionMenuView(initView)
    toggleShowingPopup()
  }, [initView, setPathItemActionMenuView, toggleShowingPopup])

  if (props.path === C.defaultPath) {
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
    }) as const
)

export default PathItemAction
