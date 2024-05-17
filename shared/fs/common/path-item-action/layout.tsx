import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as T from '@/constants/types'

export type Layout = {
  archive: boolean
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
  archive: false,
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

const isMyOwn = (parsedPath: T.FS.ParsedPathGroupTlf, me: string) =>
  !me ? false : !parsedPath.readers?.length && parsedPath.writers.length === 1 && parsedPath.writers[0] === me

const getRawLayout = (
  mode: 'row' | 'screen',
  path: T.FS.Path,
  pathItem: T.FS.PathItem,
  fileContext: T.FS.FileContext,
  me: string
): Layout => {
  const parsedPath = C.FS.parsePath(path)
  switch (parsedPath.kind) {
    case T.FS.PathKind.Root:
      // should never happen
      return empty
    case T.FS.PathKind.TlfList:
      return {
        ...empty,
        showInSystemFileManager: !C.isMobile,
      }
    case T.FS.PathKind.GroupTlf:
    case T.FS.PathKind.TeamTlf:
      return {
        ...empty,
        ...(mode === 'screen'
          ? {
              newFolder: pathItem.writable,
              openChatNonTeam: parsedPath.kind === T.FS.PathKind.GroupTlf,
              openChatTeam: parsedPath.kind === T.FS.PathKind.TeamTlf,
            }
          : {}),
        archive: true,
        ignoreTlf: parsedPath.kind === T.FS.PathKind.TeamTlf || !isMyOwn(parsedPath, me),
        showInSystemFileManager: !C.isMobile,
      }
    case T.FS.PathKind.InGroupTlf:
    case T.FS.PathKind.InTeamTlf:
      // inside tlf
      return {
        ...empty,
        ...(mode === 'screen'
          ? {
              newFolder: pathItem.writable && pathItem.type === T.FS.PathType.Folder,
              openChatNonTeam: parsedPath.kind === T.FS.PathKind.InGroupTlf,
              openChatTeam: parsedPath.kind === T.FS.PathKind.InTeamTlf,
            }
          : {}),
        archive: true,
        delete: pathItem.writable,
        download: pathItem.type === T.FS.PathType.File && !C.isIOS,
        moveOrCopy: true,
        rename: pathItem.writable && mode === 'row',
        saveMedia:
          C.isMobile && pathItem.type === T.FS.PathType.File && Constants.canSaveMedia(pathItem, fileContext),
        showInSystemFileManager: !C.isMobile,
        // share menu items
        // eslint-disable-next-line sort-keys
        sendAttachmentToChat: pathItem.type === T.FS.PathType.File,
        sendToOtherApp: pathItem.type === T.FS.PathType.File && C.isMobile,
      }
    default:
      return empty
  }
}

const totalShare = (layout: Layout) => (layout.sendAttachmentToChat ? 1 : 0) + (layout.sendToOtherApp ? 1 : 0)

const consolidateShares = (layout: Layout): Layout =>
  C.isMobile && totalShare(layout) > 1
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
  path: T.FS.Path,
  pathItem: T.FS.PathItem,
  fileContext: T.FS.FileContext,
  me: string
): Layout => consolidateShares(getRawLayout(mode, path, pathItem, fileContext, me))

export const getShareLayout = (
  mode: 'row' | 'screen',
  path: T.FS.Path,
  pathItem: T.FS.PathItem,
  fileContext: T.FS.FileContext,
  me: string
): Layout => filterForOnlyShares(getRawLayout(mode, path, pathItem, fileContext, me))

export const hasShare = (
  mode: 'row' | 'screen',
  path: T.FS.Path,
  pathItem: T.FS.PathItem,
  fileContext: T.FS.FileContext
): boolean =>
  totalShare(getRawLayout(mode, path, pathItem, fileContext, '' /* username doesn't matter for shares */)) > 0
