// @flow
import * as I from 'immutable'
import * as Types from '../../../constants/types/fs'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import PathItemAction from '.'

type OwnProps = {|
  actionIconClassName?: string,
  actionIconFontSize?: number,
  actionIconWhite?: boolean,
  path: Types.Path,
  routePath: I.List<string>,
|}

const mapStateToProps = state => ({
  _downloadKey: state.fs.pathItemActionMenu.downloadKey,
})

const mapDispatchToProps = dispatch => ({
  _onHidden: (toCancel: ?string) => {
    dispatch(FsGen.createClearRefreshTag({refreshTag: 'path-item-action-popup'}))
    dispatch(FsGen.createSetPathItemActionMenuView({view: 'root'}))
    dispatch(FsGen.createSetPathItemActionMenuDownloadKey({key: null}))
    toCancel && dispatch(FsGen.createCancelDownload({key: toCancel}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  onHidden: () => dispatchProps._onHidden(stateProps._downloadKey),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'PathItemAction'
)(PathItemAction)
