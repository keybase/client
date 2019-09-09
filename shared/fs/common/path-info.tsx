import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import {useFsPathInfo} from './hooks'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type PathInfoProps = {
  containerStyle?: Styles.StylesCrossPlatform
  knownPathInfo?: Types.PathInfo
  path: Types.Path
}

const useMountPointPath = (platformAfterMountPath: string) => {
  const sfmi = Container.useSelector(state => state.fs.sfmi)
  const mount =
    sfmi.driverStatus.type === Types.DriverStatusType.Enabled
      ? sfmi.preferredMountDirs.get(0) || sfmi.directMountDir
      : ''
  return mount && platformAfterMountPath && `${mount}${platformAfterMountPath}`
}

// name it different because of a bug in eslint that warns above in Props:
//   11:25  error  'PathInfo' was used before it was defined  no-use-before-define
const PathInfo_ = (props: PathInfoProps) => {
  const pathInfo = useFsPathInfo(props.path, props.knownPathInfo || Constants.emptyPathInfo)
  const mountPointPath = useMountPointPath(pathInfo.platformAfterMountPath)
  return (
    <Kb.Box2 direction="vertical" style={props.containerStyle} fullWidth={true}>
      <Kb.Text type="BodySmallSemibold">Universal path:</Kb.Text>
      <Kb.CopyText
        containerStyle={styles.headerCopyUniversalPath}
        multiline={Styles.isMobile ? 3 : 4}
        text={pathInfo.deeplinkPath}
      />
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

export default PathInfo_

const styles = Styles.styleSheetCreate(() => ({
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
}))
