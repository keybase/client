import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {isMobile, isIOS} from '../../../constants/platform'
import * as Flow from '../../../util/flow'

export type Layout = {
  delete: boolean
  download: boolean
  ignoreTlf: boolean
  moveOrCopy: boolean
  newFolder: boolean
  openChatNonTeam: boolean
  openChatTeam: boolean
  rename: boolean
  saveMedia: boolean
  showInSystemFileManager: boolean
  sendAttachmentToChat: boolean
  sendToOtherApp: boolean
  share: boolean
}

const empty = {
  delete: false,
  download: false,
  ignoreTlf: false,
  moveOrCopy: false,
  newFolder: false,
  openChatNonTeam: false,
  openChatTeam: false,
  rename: false,
  saveMedia: false,
  showInSystemFileManager: false,
  // share items
  // eslint-disable-next-line sort-keys
  sendAttachmentToChat: false,
  sendToOtherApp: false,
  share: false,
}

const isMyOwn = (parsedPath: Types.ParsedPathGroupTlf, me: string) =>
  !me
    ? false
    : (!parsedPath.readers || !parsedPath.readers.length) &&
      parsedPath.writers.length === 1 &&
      parsedPath.writers[0] === me

const getRawLayout = (
  mode: 'row' | 'screen',
  path: Types.Path,
  pathItem: Types.PathItem,
  fileContext: Types.FileContext,
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
        ignoreTlf: parsedPath.kind === Types.PathKind.TeamTlf || !isMyOwn(parsedPath, me),
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
        delete: pathItem.writable,
        download: pathItem.type === Types.PathType.File && !isIOS,
        moveOrCopy: true,
        rename: pathItem.writable && mode === 'row',
        saveMedia:
          isMobile && pathItem.type === Types.PathType.File && Constants.canSaveMedia(pathItem, fileContext),
        showInSystemFileManager: !isMobile,
        // share menu items
        // eslint-disable-next-line sort-keys
        sendAttachmentToChat: pathItem.type === Types.PathType.File,
        sendToOtherApp: pathItem.type === Types.PathType.File && isMobile,
      }
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(parsedPath)
      return empty
  }
}

const totalShare = layout => (layout.sendAttachmentToChat ? 1 : 0) + (layout.sendToOtherApp ? 1 : 0)

const consolidateShares = (layout: Layout): Layout =>
  isMobile && totalShare(layout) > 1
    ? {
        ...layout,
        sendAttachmentToChat: false,
        sendToOtherApp: false,
        share: true,
      }
    : layout

const filterForOnlyShares = (layout: Layout): Layout => ({
  ...empty,
  sendAttachmentToChat: layout.sendAttachmentToChat,
  sendToOtherApp: layout.sendToOtherApp,
})

export const getRootLayout = (
  mode: 'row' | 'screen',
  path: Types.Path,
  pathItem: Types.PathItem,
  fileContext: Types.FileContext,
  me: string
): Layout => consolidateShares(getRawLayout(mode, path, pathItem, fileContext, me))

export const getShareLayout = (
  mode: 'row' | 'screen',
  path: Types.Path,
  pathItem: Types.PathItem,
  fileContext: Types.FileContext,
  me: string
): Layout => filterForOnlyShares(getRawLayout(mode, path, pathItem, fileContext, me))

export const hasShare = (
  mode: 'row' | 'screen',
  path: Types.Path,
  pathItem: Types.PathItem,
  fileContext: Types.FileContext
): boolean =>
  totalShare(getRawLayout(mode, path, pathItem, fileContext, '' /* username doesn't matter for shares */)) > 0
