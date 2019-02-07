// @flow
import * as I from 'immutable'
import * as Types from '../../../constants/types/fs'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import PathItemAction, {type Clickable} from '.'

type OwnProps = {|
  clickable: Clickable,
  path: Types.Path,
  routePath: I.List<string>,
  initView: Types.PathItemActionMenuView,
|}

const mapStateToProps = state => ({
  _downloadKey: state.fs.pathItemActionMenu.downloadKey,
})

const mapDispatchToProps = (dispatch, {initView}) => ({
  _onHidden: (toCancel: ?string) => {
    dispatch(FsGen.createClearRefreshTag({refreshTag: 'path-item-action-popup'}))
    dispatch(FsGen.createSetPathItemActionMenuDownloadKey({key: null}))
    toCancel && dispatch(FsGen.createCancelDownload({key: toCancel}))
  },
  init: () => dispatch(FsGen.createSetPathItemActionMenuView({view: initView})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  clickable: ownProps.clickable,
  init: dispatchProps.init,
  onHidden: () => dispatchProps._onHidden(stateProps._downloadKey),
  path: ownProps.path,
  routePath: ownProps.routePath,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PathItemAction'
)(PathItemAction)
