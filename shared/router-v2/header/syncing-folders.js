// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import {namedConnect} from '../../util/typed-connect'
import PieSlice from '../../fs/common/pie-slice'

type Props = {|
  progress: number,
  show: boolean,
|}

const SyncingFolders = (props: Props) =>
  props.show && props.progress !== 1.0 ? (
    <Kb.Box2 direction="horizontal" alignItems="center">
      <PieSlice degrees={props.progress * 360} animated={true} />
      <Kb.Text type="BodyTiny" style={{marginLeft: 5}}>
        Syncing Folders...
      </Kb.Text>
    </Kb.Box2>
  ) : null

const mapStateToProps = state => ({
  _syncingFoldersProgress: state.fs.syncingFoldersProgress,
  online: state.fs.kbfsDaemonStatus.online,
})

const mapDispatchToProps = dispatch => ({})

const mergeProps = (s, d, o) => {
  if (s._syncingFoldersProgress.bytesTotal === 0) {
    return {progress: 0, show: false}
  }
  return {
    progress: s._syncingFoldersProgress.bytesFetched / s._syncingFoldersProgress.bytesTotal,
    show: s.online,
  }
}

type OwnProps = {||}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SyncingFolders'
)(SyncingFolders)
