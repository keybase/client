import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import {namedConnect} from '../../util/typed-connect'
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

const mapStateToProps = state => ({
  _syncingFoldersProgress: state.fs.overallSyncStatus.syncingFoldersProgress,
  online: state.fs.kbfsDaemonStatus.onlineStatus !== Types.KbfsDaemonOnlineStatus.Offline,
})

const mapDispatchToProps = () => ({})

const mergeProps = (s, _, o: OwnProps) => {
  if (s._syncingFoldersProgress.bytesTotal === 0) {
    return {progress: 0, show: false, tooltip: ''}
  }
  return {
    ...o,
    progress: s._syncingFoldersProgress.bytesFetched / s._syncingFoldersProgress.bytesTotal,
    show: s.online,
    tooltip: Constants.humanizeBytesOfTotal(
      s._syncingFoldersProgress.bytesFetched,
      s._syncingFoldersProgress.bytesTotal
    ),
  }
}

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'SyncingFolders')(SyncingFolders)
