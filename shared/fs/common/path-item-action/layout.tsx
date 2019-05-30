import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {isMobile, isIOS} from '../../../constants/platform'
import * as Flow from '../../../util/flow'

export type Layout = {
  copyPath: boolean
  delete: boolean
  download: boolean
  ignoreTlf: boolean
  moveOrCopy: boolean
  newFolder: boolean
  openChatNonTeam: boolean
  openChatTeam: boolean
  saveMedia: boolean
  showInSystemFileManager: boolean
  sendAttachmentToChat: boolean
  sendLinkToChat: boolean
  sendToOtherApp: boolean
  share: boolean
}

const empty = {
  copyPath: false,
  delete: false,
  download: false,
  ignoreTlf: false,
  moveOrCopy: false,
  newFolder: false,
  openChatNonTeam: false,
  openChatTeam: false,
  saveMedia: false,
  showInSystemFileManager: false,
  // share items
  // eslint-disable-next-line sort-keys
  sendAttachmentToChat: false,
  sendLinkToChat: false,
  sendToOtherApp: false,
  share: false,
}

const isMyOwn = (parsedPath: Types.ParsedPathGroupTlf, me: string) =>
  !me
    ? false
    : (!parsedPath.readers || !parsedPath.readers.size) &&
      parsedPath.writers.size === 1 &&
      parsedPath.writers.get(0) === me

const getRawLayout = (
  mode: 'row' | 'screen',
  path: Types.Path,
  pathItem: Types.PathItem,
  me: string
): Layout => {
  const parsedPath = Constants.parsePath(path)
  switch (parsedPath.kind) {
    case Types.PathKind.Root:
      // should never happen
      return empty
    case Types.PathKind.TlfList:
      return {
        ...empty,
        copyPath: true,
        showInSystemFileManager: !isMobile,
      }
    case Types.PathKind.GroupTlf:
    case Types.PathKind.TeamTlf:
      return {
        ...empty,
        ...(mode === 'screen'
          ? {
              newFolder: pathItem.writable,
              openChatNonTeam: parsedPath.kind === Types.PathKind.GroupTlf,
              openChatTeam: parsedPath.kind === Types.PathKind.TeamTlf,
            }
          : {}),
        copyPath: true,
        ignoreTlf: parsedPath.kind === Types.PathKind.TeamTlf || !isMyOwn(parsedPath, me),
        sendLinkToChat: Constants.canSendLinkToChat(parsedPath),
        showInSystemFileManager: !isMobile,
      }
    case Types.PathKind.InGroupTlf:
    case Types.PathKind.InTeamTlf:
      // inside tlf
      return {
        ...empty,
        ...(mode === 'screen'
          ? {
              newFolder: pathItem.writable && pathItem.type === Types.PathType.Folder,
              openChatNonTeam: parsedPath.kind === Types.PathKind.InGroupTlf,
              openChatTeam: parsedPath.kind === Types.PathKind.InTeamTlf,
            }
          : {}),
        copyPath: true,
        delete: pathItem.writable,
        download: pathItem.type === Types.PathType.File && !isIOS,
        moveOrCopy: true,
        saveMedia: isMobile && pathItem.type === Types.PathType.File && Constants.canSaveMedia(pathItem),
        showInSystemFileManager: !isMobile,
        // share menu items
        // eslint-disable-next-line sort-keys
        sendAttachmentToChat: pathItem.type === Types.PathType.File,
        sendLinkToChat: Constants.canSendLinkToChat(parsedPath),
        sendToOtherApp: pathItem.type === Types.PathType.File && isMobile,
      }
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(parsedPath)
      return empty
  }
}

const totalShare = layout =>
  (layout.sendAttachmentToChat ? 1 : 0) + (layout.sendLinkToChat ? 1 : 0) + (layout.sendToOtherApp ? 1 : 0)

const consolidateShares = (layout: Layout): Layout =>
  isMobile && totalShare(layout) > 1
    ? {
        ...layout,
        sendAttachmentToChat: false,
        sendLinkToChat: false,
        sendToOtherApp: false,
        share: true,
      }
    : layout

const filterForOnlyShares = (layout: Layout): Layout => ({
  ...empty,
  sendAttachmentToChat: layout.sendAttachmentToChat,
  sendLinkToChat: layout.sendLinkToChat,
  sendToOtherApp: layout.sendToOtherApp,
})

export const getRootLayout = (
  mode: 'row' | 'screen',
  path: Types.Path,
  pathItem: Types.PathItem,
  me: string
): Layout => consolidateShares(getRawLayout(mode, path, pathItem, me))

export const getShareLayout = (
  mode: 'row' | 'screen',
  path: Types.Path,
  pathItem: Types.PathItem,
  me: string
): Layout => filterForOnlyShares(getRawLayout(mode, path, pathItem, me))

export const hasShare = (mode: 'row' | 'screen', path: Types.Path, pathItem: Types.PathItem): boolean =>
  totalShare(getRawLayout(mode, path, pathItem, '' /* username doesn't matter for shares */)) > 0
