// @flow
import * as I from 'immutable'
import {namedConnect} from '../../util/container'
import Folder from '.'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import SecurityPrefsPromptingHoc from '../common/security-prefs-prompting-hoc'
import * as FsGen from '../../actions/fs-gen'

const mapStateToProps = (state, {path}) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  _username: state.config.username,
  resetBannerType: Constants.resetBannerType(state, path),
  shouldShowFileUIBanner: Constants.shouldShowFileUIBanner(state),
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  onAttach: (paths: Array<string>) => {
    paths.forEach(localPath => dispatch(FsGen.createUpload({localPath, parentPath: path})))
  },
})

const mergeProps = (stateProps, dispatchProps, {path, routePath}) => ({
  onAttach: stateProps._pathItem.writable ? dispatchProps.onAttach : null,
  path,
  resetBannerType: stateProps.resetBannerType,
  routePath,
  shouldShowFileUIBanner: stateProps.shouldShowFileUIBanner,
})

type OwnProps = {|
  path: Types.Path,
  routePath: I.List<string>,
|}

// flow can't figure out type when compose is used.
export default SecurityPrefsPromptingHoc<OwnProps>(
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'Folder')(Folder)
)
