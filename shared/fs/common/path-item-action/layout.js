// @flow
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {isMobile, isIOS} from '../../../constants/platform'
import * as Flow from '../../../util/flow'
import flags from '../../../util/feature-flags'

export type Layout = {
  copyPath: boolean,
  delete: boolean,
  download: boolean,
  ignoreTlf: boolean,
  moveOrCopy: boolean,
  saveMedia: boolean,
  showInSystemFileManager: boolean,
  // if multiple share items exist, they go into 2nd level menu - share
  sendAttachmentToChat: boolean,
  sendLinkToChat: boolean,
  sendToOtherApp: boolean,
  share: boolean,
}

const empty = {
  copyPath: false,
  delete: false,
  download: false,
  ignoreTlf: false,
  moveOrCopy: false,
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

const getRawLayout = (path: Types.Path, pathItem: Types.PathItem, me: string): Layout => {
  const parsedPath = Constants.parsePath(path)
  switch (parsedPath.kind) {
    case 'root':
      // should never happen
      return empty
    case 'tlf-list':
      return {
        ...empty,
        copyPath: true,
        showInSystemFileManager: !isMobile,
      }
    case 'group-tlf':
    case 'team-tlf':
      return {
        ...empty,
        copyPath: true,
        ignoreTlf: parsedPath.kind === 'team-tlf' || !isMyOwn(parsedPath, me),
        sendLinkToChat: isMobile && Constants.canSendLinkToChat(parsedPath), // desktop uses separate button
        showInSystemFileManager: !isMobile,
      }
    case 'in-group-tlf':
    case 'in-team-tlf':
      // inside tlf
      return {
        ...empty,
        copyPath: true,
        delete: true,
        download: pathItem.type === 'file' && !isIOS,
        moveOrCopy: true,
        saveMedia: isMobile && pathItem.type === 'file' && Constants.canSaveMedia(pathItem),
        showInSystemFileManager: !isMobile,
        // share menu items
        // eslint-disable-next-line sort-keys
        sendAttachmentToChat: flags.sendAttachmentToChat && isMobile && pathItem.type === 'file', // desktop uses separate button
        sendLinkToChat: isMobile && Constants.canSendLinkToChat(parsedPath), // desktop uses separate button
        sendToOtherApp: pathItem.type === 'file' && isMobile,
      }
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(parsedPath)
      return empty
  }
}

const totalShare = layout =>
  (layout.sendAttachmentToChat ? 1 : 0) + (layout.sendLinkToChat ? 1 : 0) + (layout.sendToOtherApp ? 1 : 0)

const consolidateShares = (layout: Layout): Layout =>
  totalShare(layout) > 1
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

export const getRootLayout = (path: Types.Path, pathItem: Types.PathItem, me: string): Layout =>
  consolidateShares(getRawLayout(path, pathItem, me))

export const getShareLayout = (path: Types.Path, pathItem: Types.PathItem, me: string): Layout =>
  filterForOnlyShares(getRawLayout(path, pathItem, me))

export const hasShare = (path: Types.Path, pathItem: Types.PathItem): boolean =>
  totalShare(getRawLayout(path, pathItem, '' /* username doesn't matter for shares */)) > 0
