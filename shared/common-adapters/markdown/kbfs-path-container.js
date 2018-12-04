// @flow
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import {namedConnect} from '../../util/container'
import KbfsPath from './kbfs-path'

export type OwnProps = {|
  escapedPath: string,
  allowFontScaling?: ?boolean,
|}

const mapDispatchToProps = (dispatch, {escapedPath}) => {
  const path = Constants.unescapePath(escapedPath)
  return {
    path,
    onClick: () => dispatch(FsGen.createOpenPathInFilesTab({path})),
  }
}

const mergeProps = (stateProps, {path, onClick}, {allowFontScaling}) => ({
  path,
  onClick,
  allowFontScaling,
})

export default namedConnect<OwnProps, _, _, _, _>(() => ({}), mapDispatchToProps, mergeProps, 'KbfsPath')(
  KbfsPath
)
