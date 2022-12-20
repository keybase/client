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
      ? sfmi.preferredMountDirs[0] || sfmi.directMountDir
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
      {pathInfo.deeplinkPath ? (
        <>
          <Kb.Text type="BodySmallSemibold">Universal path:</Kb.Text>
          <Kb.CopyText
            containerStyle={styles.copyPath}
            multiline={Styles.isMobile ? 3 : 4}
            text={pathInfo.deeplinkPath}
          />
        </>
      ) : null}
      {mountPointPath ? (
        <>
          <Kb.Text type="BodySmallSemibold" style={styles.localPath}>
            Local path:
          </Kb.Text>
          <Kb.CopyText
            containerStyle={styles.copyPath}
            multiline={Styles.isMobile ? 3 : 4}
            text={mountPointPath}
          />
        </>
      ) : null}
    </Kb.Box2>
  )
}

export default PathInfo_

const styles = Styles.styleSheetCreate(
  () =>
    ({
      copyPath: {
        marginTop: Styles.globalMargins.tiny,
      },
      localPath: {
        marginTop: Styles.globalMargins.small,
      },
    } as const)
)
