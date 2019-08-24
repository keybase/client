import * as Types from '../../../constants/types/fs'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import PathItemAction, {Clickable} from '.'

type OwnProps = {
  clickable: Clickable
  mode: 'screen' | 'row'
  path: Types.Path
  initView: Types.PathItemActionMenuView
}

const mapStateToProps = state => ({
  _downloadKey: state.fs.pathItemActionMenu.downloadKey,
})

const mapDispatchToProps = (dispatch, {initView}: OwnProps) => ({
  _onHidden: (toCancel: string | null) => {
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
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'PathItemAction')(
  // Super weird bug: in story mode this seems to get imported more than once.
  // First time we don't get PathItemAction at all -- it's just undefined.
  // Then later everything's normal. So just give it a dummy component in that
  // case.
  PathItemAction || (() => null)
)
