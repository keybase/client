import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type PathInfoProps = {
  deeplinkPath: string
  platformAfterMountPath: string
  containerStyle?: Styles.StylesCrossPlatform
}

const useMountPointPath = (platformAfterMountPath: string) => {
  const sfmi = Container.useSelector(state => state.fs.sfmi)
  const mount =
    sfmi.driverStatus.type === Types.DriverStatusType.Enabled
      ? sfmi.preferredMountDirs.get(0) || sfmi.directMountDir
      : ''
  return mount && `${mount}${platformAfterMountPath}`
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

export default PathInfo

const styles = Styles.styleSheetCreate({
  headerCopyUniversalPath: {
    marginTop: Styles.globalMargins.tiny,
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
})
