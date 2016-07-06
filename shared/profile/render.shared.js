import {globalColors} from '../styles/style-guide'

export function folderIconProps (folder, style = {}) {
  const type = folder.isPublic
    ? (folder.hasData ? 'iconfont-folder-public-has-files' : 'iconfont-folder-public')
    : (folder.hasData ? 'iconfont-folder-private-has-files' : 'iconfont-folder-private')

  const color = folder.isPublic
    ? globalColors.yellowGreen
    : globalColors.darkBlue2

  return {
    type,
    style: {...style, color},
  }
}
