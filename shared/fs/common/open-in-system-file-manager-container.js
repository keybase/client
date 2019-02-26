// @flow
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import {namedConnect} from '../../util/container'
import {isMobile} from '../../constants/platform'
import OpenInSystemFileManager from './open-in-system-file-manager'

type OwnProps = {|
  path: Types.Path,
|}

const mapStateToProps = (state, {path}: OwnProps) => ({
  driverEnabled: state.fs.sfmi.driverStatus.type === 'enable',
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  enableDriver: () => dispatch(FsGen.createDriverEnable({})),
  openInSystemFileManager: () => dispatch(FsGen.createOpenPathInSystemFileManager({path})),
})

export default (isMobile
  ? () => null
  : namedConnect<OwnProps, _, _, _, _>(
      mapStateToProps,
      mapDispatchToProps,
      (s, d, o) => ({...s, ...d}),
      'ConnectedOpenInSystemFileManager'
    )(OpenInSystemFileManager))
