// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import {namedConnect} from '../../util/typed-connect'
import PieSlice from '../../fs/common/pie-slice'

type Props = {|
  progress: number,
|}

const SyncingFolders = (props: Props) =>
  props.progress !== 1.0 && (
    <Kb.Box2 direction="horizontal" alignItems="center">
      <PieSlice degrees={props.progress * 360} animated={true} />
      <Kb.Text type="BodyTiny" style={{marginLeft: 5}}>
        Syncing Folders...
      </Kb.Text>
    </Kb.Box2>
  )

const mapStateToProps = state => ({
  _syncingFoldersProgress: state.fs.syncingFoldersProgress,
})

const mapDispatchToProps = dispatch => ({})

const mergeProps = (s, d, o) => {
  if (s._syncingFoldersProgress.bytesTotal === 0) {
    return {progress: 1}
  }
  return {progress: s._syncingFoldersProgress.bytesFetched / s._syncingFoldersProgress.bytesTotal}
}

type OwnProps = {||}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'SyncingFolders'
)(SyncingFolders)
