import * as Constants from '@/constants/fs'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import PieSlice from '@/fs/common/pie-slice'
import {useFsOverallSyncStatus, useKbfsDaemonStatus} from '@/fs/common/status'

type OwnProps = {
  negative?: boolean
}

type Props = {
  progress: number
  show: boolean
  tooltip: string
} & OwnProps

const SyncingFolders = (props: Props) =>
  props.show && props.progress !== 1.0 ? (
    <Kb.WithTooltip tooltip={props.tooltip} containerStyle={styles.tooltipContainer}>
      <Kb.Box2 direction="horizontal" alignItems="center">
        <PieSlice degrees={props.progress * 360} animated={true} negative={props.negative} />
        <Kb.Text type="BodyTiny" negative={props.negative} style={styles.text}>
          Syncing folders...
        </Kb.Text>
      </Kb.Box2>
    </Kb.WithTooltip>
  ) : null

const SyncFolders = (op: OwnProps) => {
  const syncingFoldersProgress = useFsOverallSyncStatus().syncingFoldersProgress
  const online = useKbfsDaemonStatus().onlineStatus !== T.FS.KbfsDaemonOnlineStatus.Offline
  const {negative} = op

  if (syncingFoldersProgress.bytesTotal === 0) {
    return null
  }

  const progress = syncingFoldersProgress.bytesFetched / syncingFoldersProgress.bytesTotal
  const tooltip = Constants.humanizeBytesOfTotal(
    syncingFoldersProgress.bytesFetched,
    syncingFoldersProgress.bytesTotal
  )
  return <SyncingFolders negative={negative} show={online} tooltip={tooltip} progress={progress} />
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  text: {marginLeft: 5},
  tooltipContainer: {alignSelf: 'center'},
}))

export default SyncFolders
