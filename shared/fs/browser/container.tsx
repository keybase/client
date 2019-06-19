import * as I from 'immutable'
import {namedConnect} from '../../util/container'
import Browser from '.'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'

type OwnProps = {
  path: Types.Path
  routePath: I.List<string>
}

const mapStateToProps = (state, {path}: OwnProps) => ({
  _kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  _tlf: Constants.getTlfFromPath(state.fs.tlfs, path),
  resetBannerType: Constants.resetBannerType(state, path),
  shouldShowSFMIBanner: state.fs.sfmi.showingBanner,
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  onAttach: (paths: Array<string>) => {
    paths.forEach(localPath => dispatch(FsGen.createUpload({localPath, parentPath: path})))
  },
})

const mergeProps = (stateProps, dispatchProps, {path, routePath}: OwnProps) => ({
  offline: Constants.isOfflineUnsynced(stateProps._kbfsDaemonStatus, stateProps._pathItem, path),
  onAttach: stateProps._pathItem.writable ? dispatchProps.onAttach : null,
  path,
  resetBannerType: stateProps.resetBannerType,
  routePath,
  shouldShowSFMIBanner: stateProps.shouldShowSFMIBanner,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Browser')(Browser)
