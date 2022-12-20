import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as Container from '../../util/container'
import PieSlice from '../../fs/common/pie-slice'

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
    <Kb.WithTooltip tooltip={props.tooltip} containerStyle={{alignSelf: 'center'}}>
      <Kb.Box2 direction="horizontal" alignItems="center">
        <PieSlice degrees={props.progress * 360} animated={true} negative={props.negative} />
        <Kb.Text type="BodyTiny" negative={props.negative} style={{marginLeft: 5}}>
          Syncing folders...
        </Kb.Text>
      </Kb.Box2>
    </Kb.WithTooltip>
  ) : null

const SyncFolders = (op: OwnProps) => {
  const syncingFoldersProgress = Container.useSelector(
    state => state.fs.overallSyncStatus.syncingFoldersProgress
  )
  const online = Container.useSelector(
    state => state.fs.kbfsDaemonStatus.onlineStatus !== Types.KbfsDaemonOnlineStatus.Offline
  )
  const {negative} = op

  if (syncingFoldersProgress.bytesTotal === 0) {
    return <SyncingFolders progress={0} show={false} tooltip="" />
  }

  const progress = syncingFoldersProgress.bytesFetched / syncingFoldersProgress.bytesTotal
  const tooltip = Constants.humanizeBytesOfTotal(
    syncingFoldersProgress.bytesFetched,
    syncingFoldersProgress.bytesTotal
  )
  return <SyncingFolders negative={negative} show={online} tooltip={tooltip} progress={progress} />
}
export default SyncFolders
