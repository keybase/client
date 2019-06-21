import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/typed-connect'
import PieSlice from '../../fs/common/pie-slice'

type Props = {
  progress: number
  show: boolean
  tooltip: string
  darkBackground?: boolean
}

const SyncingFolders = (props: Props) =>
  props.show && props.progress !== 1.0 ? (
    <Kb.WithTooltip text={props.tooltip}>
      <Kb.Box2 direction="horizontal" alignItems="center">
        <PieSlice degrees={props.progress * 360} animated={true} />
        <Kb.Text type="BodyTiny" negative={!!props.darkBackground} style={{marginLeft: 5}}>
          Syncing folders...
        </Kb.Text>
      </Kb.Box2>
    </Kb.WithTooltip>
  ) : null

const mapStateToProps = state => ({
  _syncingFoldersProgress: state.fs.overallSyncStatus.syncingFoldersProgress,
  online: state.fs.kbfsDaemonStatus.online,
})

const mapDispatchToProps = dispatch => ({})

const mergeProps = (s, d) => {
  if (s._syncingFoldersProgress.bytesTotal === 0) {
    return {progress: 0, show: false, tooltip: ''}
  }
  return {
    progress: s._syncingFoldersProgress.bytesFetched / s._syncingFoldersProgress.bytesTotal,
    show: s.online,
    tooltip: Constants.humanizeBytesOfTotal(
      s._syncingFoldersProgress.bytesFetched,
      s._syncingFoldersProgress.bytesTotal
    ),
  }
}

type OwnProps = {}

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'SyncingFolders')(SyncingFolders)
