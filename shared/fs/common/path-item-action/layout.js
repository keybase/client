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

const getRawLayout = (path: Types.Path, pathItem: Types.PathItem): Layout => {
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
        ignoreTlf: true,
        sendLinkToChat: isMobile && Constants.canSendLinkToChat(parsedPath), // desktop uses separate button
        showInSystemFileManager: !isMobile,
      }
    case 'in-group-tlf':
    case 'in-team-tlf':
      // inside tlf
      return {
        ...empty,
        copyPath: true,
        delete: pathItem.type === 'file',
        download: pathItem.type === 'file' && !isIOS,
        moveOrCopy: true,
        saveMedia: isMobile && pathItem.type === 'file' && Constants.isMedia(pathItem),
        showInSystemFileManager: !isMobile,
        // share menu items
        // eslint-disable-next-line sort-keys
        sendAttachmentToChat: flags.sendAttachmentToChat && isMobile, // desktop uses separate button
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

export const getRootLayout = (path: Types.Path, pathItem: Types.PathItem): Layout =>
  consolidateShares(getRawLayout(path, pathItem))

export const getShareLayout = (path: Types.Path, pathItem: Types.PathItem): Layout =>
  filterForOnlyShares(getRawLayout(path, pathItem))

export const hasShare = (path: Types.Path, pathItem: Types.PathItem): boolean =>
  totalShare(getRawLayout(path, pathItem)) > 0
