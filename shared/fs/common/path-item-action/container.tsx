import * as I from 'immutable'
import * as Types from '../../../constants/types/fs'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect, TypedState} from '../../../util/container'
import PathItemAction, {Props, Clickable} from '.'

type OwnProps = {
  clickable: Clickable
  mode: 'screen' | 'row'
  path: Types.Path
  routePath?: I.List<string> | null
  initView: Types.PathItemActionMenuView
}

const mapStateToProps = state => ({
  _downloadKey: state.fs.pathItemActionMenu.downloadKey,
})

const mapDispatchToProps = (dispatch, {initView}: OwnProps) => ({
  _onHidden: (toCancel: string | null) => {
    dispatch(FsGen.createClearRefreshTag({refreshTag: Types.RefreshTag.PathItemActionPopup}))
    dispatch(FsGen.createSetPathItemActionMenuDownloadKey({key: null}))
    toCancel && dispatch(FsGen.createCancelDownload({key: toCancel}))
  },
  init: () => dispatch(FsGen.createSetPathItemActionMenuView({view: initView})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  clickable: ownProps.clickable,
  init: dispatchProps.init,
  mode: ownProps.mode,
  onHidden: () => dispatchProps._onHidden(stateProps._downloadKey),
  path: ownProps.path,
  routePath: ownProps.routePath || I.List(),
})

export default namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PathItemAction'
)(PathItemAction)
