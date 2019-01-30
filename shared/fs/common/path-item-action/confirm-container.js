// @flow
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as FsGen from '../../../actions/fs-gen'
import {namedConnect} from '../../../util/container'
import Confirm from './confirm'
import type {FloatingMenuProps} from './types'

type OwnProps = {|
  floatingMenuProps: FloatingMenuProps,
  action: 'save' | 'send-to-other-app',
  path: Types.Path,
|}

const mapStateToProps = (state, {path}) => ({
  size: state.fs.pathItems.get(path, Constants.unknownPathItem).size,
})

const mapDispatchToProps = (dispatch, {action, path}: OwnProps) => ({
  confirm: () => {
    const key = Constants.makeDownloadKey(path)
    dispatch(action === 'save' ? FsGen.createSaveMedia({key, path}) : FsGen.createShareNative({key, path}))
    dispatch(FsGen.createSetPathItemActionMenuDownloadKey({key}))
    dispatch(FsGen.createSetPathItemActionMenuView({view: 'share'}))
  },
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'PathItemActionConfirm'
)(Confirm)
