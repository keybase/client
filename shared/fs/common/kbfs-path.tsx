import * as React from 'react'
import * as FsTypes from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import {fileUIName} from '../../constants/platform'
import * as Kb from '../../common-adapters'
import PathItemActionHeader from './path-item-action/header-container'

type Props = {
  deeplinkPath: string
  platformAfterMountPath: string
  rawPath: string
  standardPath: FsTypes.Path
}

type PopupProps = Props & {
  attachRef: React.Ref<any>
  onHidden: () => void
  visible: boolean
}

const useMountPointPath = (platformAfterMountPath: string) => {
  const sfmi = Container.useSelector(state => state.fs.sfmi)
  const mount =
    sfmi.driverStatus.type === FsTypes.DriverStatusType.Enabled
      ? sfmi.preferredMountDirs.get(0) || sfmi.directMountDir
      : ''
  return mount && `${mount}${platformAfterMountPath}`
}

type PathInfoProps = {
  deeplinkPath: string
  platformAfterMountPath: string
  containerStyle?: Styles.StylesCrossPlatform
}

const PathInfo = (props: PathInfoProps) => {
  const {deeplinkPath, platformAfterMountPath} = props
  const mountPointPath = useMountPointPath(platformAfterMountPath)
  return (
    <Kb.Box2 direction="vertical" style={props.containerStyle} fullWidth={true}>
      <Kb.Text type="BodySmallSemibold">Universal path:</Kb.Text>
      <Kb.CopyText containerStyle={styles.headerCopyUniversalPath} multiline={true} text={deeplinkPath} />
      {mountPointPath ? (
        <>
          <Kb.Text type="BodySmall" style={styles.headerMountPointTip}>
            You personally can access this file at
          </Kb.Text>
          <Kb.Text type="BodySmall">
            <Kb.Text type="BodySmall" selectable={true} style={styles.headerLocalPath}>
              {mountPointPath}
            </Kb.Text>
            .
          </Kb.Text>
        </>
      ) : null}
    </Kb.Box2>
  )
}

const KbfsPathPopup = (props: PopupProps) => {
  const {deeplinkPath, platformAfterMountPath, standardPath} = props
  const header = {
    title: 'header',
    view: (
      <Kb.Box2 direction="vertical" style={styles.headerContainer}>
        <PathItemActionHeader path={standardPath} noTooltip={true} />
        <Kb.Divider style={styles.headerDivider} />
        <PathInfo
          deeplinkPath={deeplinkPath}
          platformAfterMountPath={platformAfterMountPath}
          containerStyle={styles.headerPathsContainer}
        />
      </Kb.Box2>
    ),
  }
  return (
    <Kb.FloatingMenu
      closeOnSelect={true}
      containerStyle={undefined}
      attachTo={() => props.attachRef.current}
      onHidden={props.onHidden}
      position="top center"
      positionFallbacks={[]}
      header={header}
      items={[]}
      visible={props.visible}
    />
  )
}

const KbfsPath = (props: Props) => {
  const [showing, setShowing] = React.useState(false)
  const textRef = React.useRef<Text>(null)
  const text = (
    <Kb.Text type="BodyPrimaryLink" onClick={() => setShowing(true)} allowFontScaling={true} ref={textRef}>
      {props.rawPath}
    </Kb.Text>
  )
  const popup = showing ? (
    <KbfsPathPopup attachRef={textRef} visible={showing} onHidden={() => setShowing(false)} {...props} />
  ) : null
  return Styles.isMobile ? (
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

const styles = Styles.styleSheetCreate({
  headerContainer: Styles.platformStyles({
    common: {},
    isElectron: {
      maxWidth: 280,
    },
  }),
  headerCopyUniversalPath: {
    marginTop: Styles.globalMargins.tiny,
  },
  headerDivider: {
    marginTop: Styles.globalMargins.small,
  },
  headerLocalPath: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueLighter3,
    },
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
  headerMountPointTip: {
    marginTop: Styles.globalMargins.small,
  },
  headerPathsContainer: {
    padding: Styles.globalMargins.small,
  },
  textContainer: Styles.platformStyles({
    isElectron: {
      display: 'inline-block',
    },
  }),
})

export default KbfsPath
