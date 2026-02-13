import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import * as FS from '@/stores/fs'
import PathInfo from './path-info'
import PathItemInfo from './path-item-info'

type Props = {
  knownPathInfo?: T.FS.PathInfo
  rawPath: string
  standardPath: T.FS.Path
}

type PopupProps = Props & {
  attachRef: React.RefObject<Kb.MeasureRef | null>
  onHidden: () => void
  visible: boolean
}

const useOpenInFilesTab = (path: T.FS.Path) => {
  return React.useCallback(() => FS.navToPath(path), [path])
}

const KbfsPathPopup = (props: PopupProps) => {
  const openInFilesTab = useOpenInFilesTab(props.standardPath)
  const header = (
    <Kb.Box2 direction="vertical" style={styles.headerContainer} centerChildren={true} fullWidth={true}>
      <PathItemInfo
        path={props.standardPath}
        containerStyle={Kb.Styles.collapseStyles([styles.sectionContainer, styles.noBottomPadding])}
      />
      <Kb.Divider />
      <PathInfo
        path={props.standardPath}
        knownPathInfo={props.knownPathInfo}
        containerStyle={styles.sectionContainer}
      />
    </Kb.Box2>
  )

  return (
    <Kb.FloatingMenu
      closeOnSelect={true}
      attachTo={props.attachRef}
      onHidden={props.onHidden}
      position="top center"
      propagateOutsideClicks={!Kb.Styles.isMobile}
      header={header}
      items={
        Kb.Styles.isMobile
          ? [
              'Divider',
              {
                icon: 'iconfont-file',
                onClick: openInFilesTab,
                title: 'Open',
              },
            ]
          : []
      }
      visible={props.visible}
    />
  )
}

const KbfsPath = (props: Props) => {
  const [showing, setShowing] = React.useState(false)
  const textRef = React.useRef<Kb.MeasureRef | null>(null)
  const openInFilesTab = useOpenInFilesTab(props.standardPath)
  const text = (
    <Kb.Text
      type="BodyPrimaryLink"
      onClick={openInFilesTab}
      onLongPress={() => setShowing(true)}
      allowFontScaling={true}
      textRef={textRef}
    >
      {props.rawPath}
    </Kb.Text>
  )
  const popup = showing ? (
    <KbfsPathPopup attachRef={textRef} visible={showing} onHidden={() => setShowing(false)} {...props} />
  ) : null
  return Kb.Styles.isMobile ? (
    <>
      {text}
      {popup}
    </>
  ) : (
    <Kb.Box
      style={styles.textContainer}
      onMouseOver={() => setShowing(true)}
      onMouseLeave={() => setShowing(false)}
    >
      {text}
      {popup}
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      headerContainer: Kb.Styles.platformStyles({
        isElectron: {
          maxWidth: 280,
        },
      }),
      noBottomPadding: {paddingBottom: 0},
      sectionContainer: Kb.Styles.platformStyles({
        common: {
          padding: Kb.Styles.globalMargins.small,
        },
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.medium,
          paddingTop: Kb.Styles.globalMargins.large,
        },
      }),
      textContainer: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
        },
      }),
    }) as const
)

export default KbfsPath
