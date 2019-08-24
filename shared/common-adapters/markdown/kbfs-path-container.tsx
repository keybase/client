import * as Constants from '../../constants/fs'
import {StylesTextCrossPlatform} from '../../common-adapters/text'
import {namedConnect} from '../../util/container'
import KbfsPath from './kbfs-path'

export type OwnProps = {
  escapedPath: string
  allowFontScaling?: boolean | null
  style?: StylesTextCrossPlatform
}

const mapDispatchToProps = (dispatch, {escapedPath}: OwnProps) => {
  const path = Constants.unescapePath(escapedPath)
  return {
    onClick: () => dispatch(Constants.makeActionForOpenPathInFilesTab(path)),
    path,
  }
}

const mergeProps = (_, {path, onClick}, {allowFontScaling, style}: OwnProps) => ({
  allowFontScaling,
  onClick,
  path,
  style,
})

export default namedConnect(() => ({}), mapDispatchToProps, mergeProps, 'KbfsPath')(KbfsPath)
