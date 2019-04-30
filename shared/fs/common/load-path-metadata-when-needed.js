// @flow
import * as React from 'react'
import {namedConnect} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'

type OwnProps = {|
  path: Types.Path,
  refreshTag?: ?Types.RefreshTag,
|}

const mapStateToProps = state => ({
  syncingFoldersProgress: state.fs.syncingFoldersProgress,
})

const mapDispatchToProps = (dispatch, {path, refreshTag}) => ({
  loadPathMetadata: setRefreshTag =>
    dispatch(FsGen.createLoadPathMetadata({path, refreshTag: setRefreshTag ? refreshTag : null})),
})

const mergeProps = (s, d, o) => ({
  ...s,
  ...d,
  path: o.path,
})

type Props = {|
  loadPathMetadata: (setRefreshTag: boolean) => void,
  path: Types.Path,
  syncingFoldersProgress: Types.SyncingFoldersProgress,
|}

class LoadPathMetadataWhenNeeded extends React.PureComponent<Props> {
  componentDidMount() {
    this.props.loadPathMetadata(true)
  }
  componentDidUpdate(prevProps) {
    if (this.props.syncingFoldersProgress !== prevProps.syncingFoldersProgress) {
      // If syncingFoldersProgress (i.e. the overall syncing progress) changes,
      // refresh current one so we get updated prefetchStatus in case they
      // change.
      //
      // We omit the refreshTag here because notifications don't get triggered
      // for prefetchStatus changes and it take a few points to do that. If
      // this turns out to cause performance issues, we can figure that out as
      // an optimization.
      this.props.loadPathMetadata(false)
    } else if (this.props.path !== prevProps.path) {
      this.props.loadPathMetadata(true)
    }
  }
  render() {
    return null
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'LoadPathMetadataWhenNeeded'
)(LoadPathMetadataWhenNeeded)
