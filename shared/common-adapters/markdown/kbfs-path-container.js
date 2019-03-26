// @flow
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import KbfsPath from './kbfs-path'

export type OwnProps = {|
  escapedPath: string,
  allowFontScaling?: ?boolean,
|}

const mapDispatchToProps = (dispatch, {escapedPath}) => {
  const path = Constants.unescapePath(escapedPath)
  return {
    onClick: () => dispatch(Constants.makeActionForOpenPathInFilesTab(path)),
    path,
  }
}

const mergeProps = (stateProps, {path, onClick}, {allowFontScaling}) => ({
  allowFontScaling,
  onClick,
  path,
})

export default namedConnect<OwnProps, _, _, _, _>(() => ({}), mapDispatchToProps, mergeProps, 'KbfsPath')(
  KbfsPath
)
