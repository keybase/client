import * as React from 'react'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import ChooseView from './choose-view'
import type {SizeType} from '@/common-adapters/icon'
import * as FS from '@/stores/fs'

export type ClickableProps = {
  onClick: () => void
  mref: React.RefObject<Kb.MeasureRef | null>
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
  measureRef: React.RefObject<Kb.MeasureRef | null>
  onClick: () => void
  sizeType: SizeType
  actionIconWhite?: boolean | undefined
}
function IconClickable(props: ICProps) {
  const {measureRef, actionIconWhite, sizeType, onClick} = props
  return (
    <Kb.WithTooltip tooltip="More actions">
      <Kb.Box2 direction="vertical" ref={measureRef}>
        <Kb.Icon
          type="iconfont-ellipsis"
          color={actionIconWhite ? Kb.Styles.globalColors.whiteOrBlueDark : Kb.Styles.globalColors.black_50}
          hoverColor={actionIconWhite ? undefined : Kb.Styles.globalColors.black}
          padding="tiny"
          sizeType={sizeType}
          onClick={onClick}
        />
      </Kb.Box2>
    </Kb.WithTooltip>
  )
}

const PathItemAction = (props: Props) => {
  const {initView, path, mode} = props
  const [previousView, setPreviousView] = React.useState(initView)
  const [view, setViewState] = React.useState(initView)
  const [downloadState, setDownloadState] = React.useState<{
    downloadID?: string
    downloadIntent?: T.FS.DownloadIntent
  }>({})

  const setView = (nextView: T.FS.PathItemActionMenuView) => {
    setPreviousView(view)
    setViewState(nextView)
  }
  const onDownloadStarted = (downloadID: string, downloadIntent?: T.FS.DownloadIntent) => {
    setDownloadState({downloadID, downloadIntent})
  }

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p

    const hide = () => {
      hidePopup()
      setPreviousView(initView)
      setViewState(initView)
      setDownloadState({})
    }

    return (
      <ChooseView
        downloadID={downloadState.downloadID}
        downloadIntent={downloadState.downloadIntent}
        onDownloadStarted={onDownloadStarted}
        path={path}
        mode={mode}
        previousView={previousView}
        setView={setView}
        view={view}
        floatingMenuProps={{
          attachTo,
          containerStyle: styles.floatingContainer,
          hide,
          visible: true,
        }}
      />
    )
  }
  const {showPopup, showingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  const onClick = () => {
    setPreviousView(initView)
    setViewState(initView)
    setDownloadState({})
    showPopup()
  }

  if (props.path === FS.defaultPath) {
    return null
  }

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
