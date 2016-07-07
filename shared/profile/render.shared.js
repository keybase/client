import {globalColors} from '../styles/style-guide'

export function folderIconProps (folder, style = {}) {
  const type = folder.isPublic
    ? (folder.hasData ? 'fa-kb-iconfont-folder-public-has-files' : 'fa-kb-iconfont-folder-public')
    : (folder.hasData ? 'fa-kb-iconfont-folder-private-has-files' : 'fa-kb-iconfont-folder-private')

  const color = folder.isPublic
    ? globalColors.yellowGreen
    : globalColors.darkBlue2

  return {
    type,
    style: {...style, color},
  }
}
