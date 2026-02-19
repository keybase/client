import * as T from '@/constants/types'
import {useFsPathInfo} from './hooks'
import * as Kb from '@/common-adapters'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type PathInfoProps = {
  containerStyle?: Kb.Styles.StylesCrossPlatform
  knownPathInfo?: T.FS.PathInfo
  path: T.FS.Path
}

const useMountPointPath = (platformAfterMountPath: string) => {
  const sfmi = useFSState(s => s.sfmi)
  const mount =
    sfmi.driverStatus.type === T.FS.DriverStatusType.Enabled
      ? sfmi.preferredMountDirs[0] || sfmi.directMountDir
      : ''
  return mount && platformAfterMountPath && `${mount}${platformAfterMountPath}`
}

// name it different because of a bug in eslint that warns above in Props:
//   11:25  error  'PathInfo' was used before it was defined  no-use-before-define
const PathInfo_ = (props: PathInfoProps) => {
  const pathInfo = useFsPathInfo(props.path, props.knownPathInfo || FS.emptyPathInfo)
  const mountPointPath = useMountPointPath(pathInfo.platformAfterMountPath)
  return (
    <Kb.Box2 direction="vertical" style={props.containerStyle} fullWidth={true}>
      {pathInfo.deeplinkPath ? (
        <>
          <Kb.Text type="BodySmallSemibold">Universal path:</Kb.Text>
          <Kb.CopyText containerStyle={styles.copyPath} multiline={1} text={pathInfo.deeplinkPath} />
        </>
      ) : null}
      {mountPointPath ? (
        <>
          <Kb.Text type="BodySmallSemibold" style={styles.localPath}>
            Local path:
          </Kb.Text>
          <Kb.CopyText containerStyle={styles.copyPath} multiline={1} text={mountPointPath} />
        </>
      ) : null}
    </Kb.Box2>
  )
}

export default PathInfo_

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      copyPath: {
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      localPath: {
        marginTop: Kb.Styles.globalMargins.small,
      },
    }) as const
)
