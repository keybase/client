import * as React from 'react'
import {namedConnect} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'

type OwnProps = {
  path: Types.Path
  refreshTag?: Types.RefreshTag | null
}

const mapStateToProps = state => ({
  syncingFoldersProgress: state.fs.overallSyncStatus.syncingFoldersProgress,
})

const mapDispatchToProps = (dispatch, {path, refreshTag}) => ({
  loadPathMetadataWithRefreshTag: () => dispatch(FsGen.createLoadPathMetadata({path, refreshTag})),
  loadPathMetadataWithoutRefreshTag: () => dispatch(FsGen.createLoadPathMetadata({path})),
})

const mergeProps = (s, d, o) => ({
  ...s,
  ...d,
  path: o.path,
})

type Props = {
  loadPathMetadataWithRefreshTag: () => void
  loadPathMetadataWithoutRefreshTag: () => void
  path: Types.Path
  syncingFoldersProgress: Types.SyncingFoldersProgress
}

class LoadPathMetadataWhenNeeded extends React.PureComponent<Props> {
  componentDidMount() {
    this.props.loadPathMetadataWithRefreshTag()
  }
  componentDidUpdate(prevProps) {
    if (this.props.path !== prevProps.path) {
      this.props.loadPathMetadataWithRefreshTag()
    } else if (this.props.syncingFoldersProgress !== prevProps.syncingFoldersProgress) {
      // If syncingFoldersProgress (i.e. the overall syncing progress) changes,
      // refresh current one so we get updated prefetchStatus in case they
      // change.
      //
      // We omit the refreshTag here because notifications don't get triggered
      // for prefetchStatus changes and it take a few points to do that. If
      // this turns out to cause performance issues, we can figure that out as
      // an optimization.
      this.props.loadPathMetadataWithoutRefreshTag()
    }
  }
  render() {
    return null
  }
}

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'LoadPathMetadataWhenNeeded')(
  LoadPathMetadataWhenNeeded
)
