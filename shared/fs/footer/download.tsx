import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as Container from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import DownloadWrapper from './download-wrapper'
import {formatDurationFromNowTo} from '../../util/timestamp'
import {isMobile} from '../../constants/platform'

export type Props = {
  downloadID: string
  isFirst: boolean
}

const getProgress = (dlState: Types.DownloadState) => (
  <Kb.Box2 style={styles.progress} direction="horizontal" fullWidth={true} centerChildren={true} gap="xtiny">
    <Kb.Box style={styles.tubeBox}>
      <Kb.Box style={styles.tube} />
      <Kb.Box
        style={Styles.collapseStyles([
          styles.tube,
          styles.tubeStuffing,
          {width: `${Math.round(100 * dlState.progress).toString()}%`},
        ])}
      />
    </Kb.Box>
    <Kb.Text type="BodyTinySemibold" negative={true}>
      {formatDurationFromNowTo(dlState.endEstimate)}
    </Kb.Text>
  </Kb.Box2>
)

const Download = (props: Props) => {
  const dlInfo = Kbfs.useFsDownloadInfo(props.downloadID)
  const dlState = Container.useSelector(
    state => state.fs.downloads.state.get(props.downloadID) || Constants.emptyDownloadState
  )
  const dispatch = Container.useDispatch()
  const open = dlState.localPath
    ? () => dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: dlState.localPath}))
    : () => {}
  const dismiss = () => dispatch(FsGen.createDismissDownload({downloadID: props.downloadID}))
  const cancel = () => dispatch(FsGen.createCancelDownload({downloadID: props.downloadID}))
  Kbfs.useFsWatchDownloadForMobile(props.downloadID, Types.DownloadIntent.None)
  return (
    <DownloadWrapper dismiss={dismiss} isFirst={props.isFirst} done={dlState.done}>
      <Kb.Box2
        direction="horizontal"
        centerChildren={true}
        style={Styles.collapseStyles([styles.download, !!dlState.error && styles.red])}
        gap="tiny"
        gapStart={true}
        gapEnd={true}
      >
        <Kb.Box2 direction="vertical" centerChildren={true} fullHeight={true}>
          <Kb.Icon
            type={dlState.done ? 'iconfont-success' : 'iconfont-download'}
            color={Styles.globalColors.black_20}
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" style={styles.nameAndProgress}>
          <Kb.Text
            type="BodySmallSemibold"
            onClick={isMobile ? undefined : open}
            style={styles.filename}
            lineClamp={isMobile ? 1 : undefined}
          >
            {dlInfo.filename}
          </Kb.Text>
          {Constants.downloadIsOngoing(dlState) && getProgress(dlState)}
        </Kb.Box2>
        <Kb.Box2 direction="vertical" centerChildren={true} fullHeight={true}>
          <Kb.Icon
            type="iconfont-remove"
            color={Styles.globalColors.white}
            onClick={!Constants.downloadIsOngoing(dlState) ? dismiss : cancel}
          />
        </Kb.Box2>
      </Kb.Box2>
    </DownloadWrapper>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      download: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.green,
          borderRadius: 4,
        },
        isElectron: {
          height: 32,
          width: 140,
        },
        isMobile: {
          height: 40,
          width: 160,
        },
      }),
      filename: Styles.platformStyles({
        common: {
          color: Styles.globalColors.white,
        },
        isElectron: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      nameAndProgress: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
      },
      progress: {
        marginTop: -2,
      },
      red: {
        backgroundColor: Styles.globalColors.red,
      },
      tube: {
        backgroundColor: Styles.globalColors.black_20,
        borderRadius: 4.5,
        height: 4,
        width: '100%',
      },
      tubeBox: {
        flex: 1,
        position: 'relative',
      },
      tubeStuffing: {
        backgroundColor: Styles.globalColors.white,
        left: 0,
        position: 'absolute',
        top: 0,
      },
    } as const)
)

export default Download
