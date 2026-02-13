import * as Kb from '@/common-adapters'
import * as Kbfs from '../common'
import * as C from '@/constants'
import * as T from '@/constants/types'
import DownloadWrapper from './download-wrapper'
import {formatDurationFromNowTo} from '@/util/timestamp'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'

export type Props = {
  downloadID: string
  isFirst: boolean
}

const getProgress = (dlState: T.FS.DownloadState) => (
  <Kb.Box2 style={styles.progress} direction="horizontal" fullWidth={true} centerChildren={true} gap="xtiny">
    <Kb.Box style={styles.tubeBox}>
      <Kb.Box style={styles.tube} />
      <Kb.Box
        style={Kb.Styles.collapseStyles([
          styles.tube,
          styles.tubeStuffing,
          {width: `${Math.round(100 * dlState.progress)}%`},
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
  const {dlState, openLocalPathInSystemFileManagerDesktop, dismissDownload, cancelDownload} = useFSState(
    C.useShallow(s => ({
      cancelDownload: s.dispatch.cancelDownload,
      dismissDownload: s.dispatch.dismissDownload,
      dlState: s.downloads.state.get(props.downloadID) || FS.emptyDownloadState,
      openLocalPathInSystemFileManagerDesktop: s.dispatch.defer.openLocalPathInSystemFileManagerDesktop,
    }))
  )
  const open = dlState.localPath
    ? () => openLocalPathInSystemFileManagerDesktop?.(dlState.localPath)
    : () => {}
  const dismiss = () => dismissDownload(props.downloadID)
  const cancel = () => cancelDownload(props.downloadID)
  Kbfs.useFsWatchDownloadForMobile(props.downloadID, T.FS.DownloadIntent.None)
  return (
    <DownloadWrapper dismiss={dismiss} isFirst={props.isFirst} done={dlState.done}>
      <Kb.Box2
        direction="horizontal"
        centerChildren={true}
        style={Kb.Styles.collapseStyles([styles.download, !!dlState.error && styles.red])}
        gap="tiny"
        gapStart={true}
        gapEnd={true}
      >
        <Kb.Box2 direction="vertical" centerChildren={true} fullHeight={true}>
          <Kb.Icon
            type={dlState.done ? 'iconfont-success' : 'iconfont-download'}
            color={Kb.Styles.globalColors.black_20}
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" style={styles.nameAndProgress}>
          <Kb.Text
            type="BodySmallSemibold"
            onClick={C.isMobile ? undefined : open}
            style={styles.filename}
            lineClamp={C.isMobile ? 1 : undefined}
          >
            {dlInfo.filename}
          </Kb.Text>
          {FS.downloadIsOngoing(dlState) && getProgress(dlState)}
        </Kb.Box2>
        <Kb.Box2 direction="vertical" centerChildren={true} fullHeight={true}>
          <Kb.Icon
            type="iconfont-remove"
            color={Kb.Styles.globalColors.white}
            onClick={!FS.downloadIsOngoing(dlState) ? dismiss : cancel}
          />
        </Kb.Box2>
      </Kb.Box2>
    </DownloadWrapper>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      download: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.green,
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
      filename: Kb.Styles.platformStyles({
        common: {
          color: Kb.Styles.globalColors.white,
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
        backgroundColor: Kb.Styles.globalColors.red,
      },
      tube: {
        backgroundColor: Kb.Styles.globalColors.black_20,
        borderRadius: 4.5,
        height: 4,
        width: '100%',
      },
      tubeBox: {
        flex: 1,
        position: 'relative',
      },
      tubeStuffing: {
        backgroundColor: Kb.Styles.globalColors.white,
        left: 0,
        position: 'absolute',
        top: 0,
      },
    }) as const
)

export default Download
