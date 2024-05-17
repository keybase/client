import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as Kb from '@/common-adapters'
import * as Kbfs from '@/fs/common/hooks'
import * as React from 'react'
import * as T from '@/constants/types'
import * as Util from '@/util/kbfs'
import Header from './header'
import type {FloatingMenuProps} from './types'
import {getRootLayout, getShareLayout} from './layout'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  path: T.FS.Path
  mode: 'row' | 'screen'
}

const needConfirm = (pathItem: T.FS.PathItem) =>
  pathItem.type === T.FS.PathType.File && pathItem.size > 50 * 1024 * 1024

const Container = (op: OwnProps) => {
  const {path, mode, floatingMenuProps} = op
  const {hide, containerStyle, attachTo, visible} = floatingMenuProps
  Kbfs.useFsFileContext(path)
  const pathItem = C.useFSState(s => Constants.getPathItem(s.pathItems, path))
  const pathItemActionMenu = C.useFSState(s => s.pathItemActionMenu)
  const {downloadID, downloadIntent, view} = pathItemActionMenu
  const username = C.useCurrentUserState(s => s.username)
  const fileContext = C.useFSState(s => s.fileContext.get(path) || Constants.emptyFileContext)
  const getLayout = view === T.FS.PathItemActionMenuView.Share ? getShareLayout : getRootLayout
  const layout = getLayout(mode, path, pathItem, fileContext, username)
  const cancelDownload = C.useFSState(s => s.dispatch.cancelDownload)
  const cancel = () => {
    C.isMobile && downloadID && cancelDownload(downloadID)
  }
  const setPathItemActionMenuView = C.useFSState(s => s.dispatch.setPathItemActionMenuView)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const download = C.useFSState(s => s.dispatch.download)
  const saving = downloadID && downloadIntent === T.FS.DownloadIntent.CameraRoll
  const sharing = downloadID && downloadIntent === T.FS.DownloadIntent.Share

  const hideAfter = (onClick: (evt?: React.SyntheticEvent) => void) => (evt?: React.SyntheticEvent) => {
    onClick(evt)
    hide()
  }
  const cancelAfter = (f: () => void) => () => {
    f()
    cancel()
  }
  const hideAndCancelAfter = (f: () => void) => hideAfter(cancelAfter(f))

  const newFolderRow = C.useFSState(s => s.dispatch.newFolderRow)
  const itemNewFolder = layout.newFolder
    ? ([
        {
          icon: 'iconfont-folder-new',
          onClick: hideAndCancelAfter(() => {
            newFolderRow(path)
          }),
          title: 'New folder',
        },
      ] as const)
    : []

  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const openChat = cancelAfter(() => {
    previewConversation({
      reason: 'files',
      // tlfToParticipantsOrTeamname will route both public and private
      // folders to a private chat, which is exactly what we want.
      ...Util.tlfToParticipantsOrTeamname(T.FS.pathToString(path)),
    })
  })
  const itemChatTeam = layout.openChatTeam
    ? ([{icon: 'iconfont-chat', onClick: hideAfter(openChat), title: 'Chat with team'}] as const)
    : []
  const itemChat = layout.openChatNonTeam
    ? ([{icon: 'iconfont-chat', onClick: hideAfter(openChat), title: 'Chat with them'}] as const)
    : []

  const openPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openPathInSystemFileManagerDesktop
  )
  const sfmiEnabled = C.useFSState(s => s.sfmi.driverStatus.type === T.FS.DriverStatusType.Enabled)
  const itemFinder =
    layout.showInSystemFileManager && sfmiEnabled
      ? ([
          {
            icon: 'iconfont-finder',
            onClick: hideAndCancelAfter(() => {
              openPathInSystemFileManagerDesktop?.(path)
            }),
            title: 'Show in ' + C.fileUIName,
          },
        ] as const)
      : []

  const itemSave = (() => {
    if (!layout.saveMedia) return []
    if (saving) {
      return [
        {
          disabled: true,
          icon: 'iconfont-download-2',
          inProgress: true,
          onClick: undefined,
          title: 'Save',
        },
      ] as const
    } else {
      const onClick = needConfirm(pathItem)
        ? () => {
            setPathItemActionMenuView(T.FS.PathItemActionMenuView.ConfirmSaveMedia)
            cancel()
          }
        : () => {
            download(path, 'saveMedia')
            cancel()
          }
      return [{icon: 'iconfont-download-2', onClick, title: 'Save'}] as const
    }
  })()

  const itemShare = layout.share
    ? ([
        {
          icon: 'iconfont-share',
          onClick: () => {
            setPathItemActionMenuView(T.FS.PathItemActionMenuView.Share)
          },
          title: 'Share...',
        },
      ] as const)
    : []

  const itemSendToChat = layout.sendAttachmentToChat
    ? ([
        {
          icon: 'iconfont-chat',
          onClick: hideAndCancelAfter(() => {
            path && navigateAppend({props: {sendPaths: [path]}, selected: 'chatSendToChat'})
          }),
          subTitle: `The ${
            pathItem.type === T.FS.PathType.Folder ? 'folder' : 'file'
          } will be sent as an attachment.`,
          title: 'Attach in another conversation',
        },
      ] as const)
    : []

  const itemSendToApp = (() => {
    if (!layout.sendToOtherApp) return []
    if (sharing) {
      return [
        {
          disabled: true,
          icon: 'iconfont-share',
          inProgress: true,
          onClick: undefined,
          title: 'Send to another app',
        },
      ] as const
    } else {
      const conf = needConfirm(pathItem)
      const onClick = cancelAfter(() => {
        if (conf) {
          setPathItemActionMenuView(T.FS.PathItemActionMenuView.ConfirmSendToOtherApp)
        } else {
          download(path, 'share')
        }
      })
      return [{icon: 'iconfont-share', onClick, title: 'Send to another app'}] as const
    }
  })()

  const itemDownload = layout.download
    ? ([
        {
          icon: 'iconfont-download-2',
          onClick: hideAndCancelAfter(() => {
            download(path, 'download')
          }),
          title: 'Download',
        },
      ] as const)
    : []

  const ignoreNeedsToWait = C.Waiting.useAnyWaiting([
    Constants.folderListWaitingKey,
    Constants.statWaitingKey,
  ])
  const favoriteIgnore = C.useFSState(s => s.dispatch.favoriteIgnore)
  const ignoreTlf = layout.ignoreTlf
    ? ignoreNeedsToWait
      ? ('disabled' as const)
      : cancelAfter(() => {
          favoriteIgnore(path)
        })
    : undefined
  const itemIgnore = ignoreTlf
    ? ([
        {
          danger: true,
          disabled: ignoreTlf === 'disabled',
          icon: 'iconfont-hide',
          onClick: ignoreTlf === 'disabled' ? undefined : hideAfter(ignoreTlf),
          progressIndicator: ignoreTlf === 'disabled',
          subTitle: 'Will hide the folder from your list.',
          title: 'Ignore this folder',
        },
      ] as const)
    : []

  const startRename = C.useFSState(s => s.dispatch.startRename)
  const itemRename = layout.rename
    ? ([
        {
          icon: 'iconfont-edit',
          onClick: hideAndCancelAfter(() => {
            startRename(path)
          }),
          title: 'Rename',
        },
      ] as const)
    : []

  const itemDelete = layout.delete
    ? ([
        {
          danger: true,
          icon: 'iconfont-trash',
          onClick: hideAfter(() => {
            navigateAppend({props: {mode, path}, selected: 'confirmDelete'})
          }),
          title: 'Delete',
        },
      ] as const)
    : []

  const onArchive =
    C.featureFlags.archive && path && layout.archive && pathItem.type === T.FS.PathType.Folder
      ? () => {
          navigateAppend({
            props: {path, type: 'fsPath'} as const,
            selected: 'archiveModal',
          })
        }
      : undefined
  const itemArchive = onArchive
    ? ([
        {
          icon: 'iconfont-folder-downloads',
          onClick: hideAfter(() => onArchive()),
          title: 'Archive folder',
        },
      ] as const)
    : []

  const items: Kb.MenuItems = [
    ...itemNewFolder,
    ...itemChatTeam,
    ...itemChat,
    ...itemFinder,
    ...itemSave,
    ...itemShare,
    ...itemSendToChat,
    ...itemSendToApp,
    ...itemDownload,
    ...itemIgnore,
    ...itemRename,
    ...itemArchive,
    ...itemDelete,
  ]

  const justDoneWithIntent = Kbfs.useFsWatchDownloadForMobile(downloadID || '', downloadIntent)
  React.useEffect(() => {
    justDoneWithIntent && hide()
  }, [justDoneWithIntent, hide])

  const dismissDownload = C.useFSState(s => s.dispatch.dismissDownload)
  const userInitiatedHide = React.useCallback(() => {
    hide()
    downloadID && dismissDownload(downloadID)
  }, [downloadID, hide, dismissDownload])

  return (
    <Kb.FloatingMenu
      closeText="Cancel"
      closeOnSelect={false}
      containerStyle={containerStyle}
      attachTo={attachTo}
      visible={visible}
      onHidden={userInitiatedHide}
      position="left center"
      header={<Header path={path} />}
      items={items.length ? ['Divider' as const, ...items] : items}
    />
  )
}

export default Container
