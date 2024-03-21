import * as React from 'react'
import type * as T from '@/constants/types'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import ChooseView from './choose-view'
import type {SizeType} from '@/common-adapters/icon'

export type ClickableProps = {
  onClick: () => void
  mref: React.RefObject<Kb.MeasureRef>
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

type ICProps = {
  measureRef: React.RefObject<Kb.MeasureRef>
  onClick: () => void
  sizeType: SizeType
  actionIconWhite?: boolean | undefined
}
const IconClickable = React.memo(function IconClickable(props: ICProps) {
  return (
    <Kb.WithTooltip tooltip="More actions">
      <Kb.Icon
        fixOverdraw={false}
        type="iconfont-ellipsis"
        color={
          props.actionIconWhite ? Kb.Styles.globalColors.whiteOrBlueDark : Kb.Styles.globalColors.black_50
        }
        hoverColor={props.actionIconWhite ? undefined : Kb.Styles.globalColors.black}
        padding="tiny"
        sizeType={props.sizeType}
        onClick={props.onClick}
        ref={props.measureRef}
      />
    </Kb.WithTooltip>
  )
})

const PathItemAction = (props: Props) => {
  const {initView, path, mode} = props
  const setPathItemActionMenuDownload = C.useFSState(s => s.dispatch.setPathItemActionMenuDownload)
  const setPathItemActionMenuView = C.useFSState(s => s.dispatch.setPathItemActionMenuView)

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p

      const hide = () => {
        hidePopup()
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
  const {showPopup, showingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  const onClick = React.useCallback(() => {
    setPathItemActionMenuView(initView)
    showPopup()
  }, [initView, setPathItemActionMenuView, showPopup])

  if (props.path === C.FS.defaultPath) {
    return null
  }

  // TODO: should probably React.memo this as it's on every row. Would need to
  // do something about the `clickable` prop though, perhaps flattening it.
  return (
    <>
      {props.clickable.type === 'component' && (
        <props.clickable.component onClick={onClick} mref={popupAnchor} />
      )}
      {props.clickable.type === 'icon' && (
        <IconClickable
          onClick={onClick}
          measureRef={popupAnchor}
          sizeType={props.clickable.sizeType ?? 'Default'}
          actionIconWhite={props.clickable.actionIconWhite}
        />
      )}
      {showingPopup && popup}
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      floatingContainer: Kb.Styles.platformStyles({
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
