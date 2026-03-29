import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as Kbfs from '@/fs/common/hooks'
import * as React from 'react'
import * as T from '@/constants/types'
import * as Util from '@/util/kbfs'
import Header from './header'
import type {FloatingMenuProps} from './types'
import {getRootLayout, getShareLayout} from './layout'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'
import {useCurrentUserState} from '@/stores/current-user'
import {useEditContext} from '@/fs/browser/ui-context'

type OwnProps = {
  floatingMenuProps: FloatingMenuProps
  previousView: T.FS.PathItemActionMenuView
  path: T.FS.Path
  mode: 'row' | 'screen'
  setView: (view: T.FS.PathItemActionMenuView) => void
  view: T.FS.PathItemActionMenuView
}

const needConfirm = (pathItem: T.FS.PathItem) =>
  pathItem.type === T.FS.PathType.File && pathItem.size > 50 * 1024 * 1024

const Container = (op: OwnProps) => {
  const {path, mode, floatingMenuProps, setView, view} = op
  const {newFolderRow, startRename} = useEditContext()
  const {hide, containerStyle, attachTo, visible} = floatingMenuProps
  Kbfs.useFsFileContext(path)
  const data = useFSState(
    C.useShallow(s => {
      const pathItem = FS.getPathItem(s.pathItems, path)
      const pathItemActionMenu = s.pathItemActionMenu
      const fileContext = s.fileContext.get(path) || FS.emptyFileContext
      const {cancelDownload, download} = s.dispatch
      const {favoriteIgnore, dismissDownload} = s.dispatch
      const {openPathInSystemFileManagerDesktop} = s.dispatch.defer
      const sfmiEnabled = s.sfmi.driverStatus.type === T.FS.DriverStatusType.Enabled
      return {
        cancelDownload,
        dismissDownload,
        download,
        favoriteIgnore,
        fileContext,
        openPathInSystemFileManagerDesktop,
        pathItem,
        pathItemActionMenu,
        sfmiEnabled,
      }
    })
  )

  const {pathItem, pathItemActionMenu, fileContext, cancelDownload} = data
  const {download, openPathInSystemFileManagerDesktop} = data
  const {sfmiEnabled, favoriteIgnore, dismissDownload} = data

  const {downloadID, downloadIntent} = pathItemActionMenu
  const username = useCurrentUserState(s => s.username)
  const getLayout = view === T.FS.PathItemActionMenuView.Share ? getShareLayout : getRootLayout
  const layout = getLayout(mode, path, pathItem, fileContext, username)
  const cancel = () => {
    C.isMobile && downloadID && cancelDownload(downloadID)
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
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

  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
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

  const fileContextLoading =
    C.isMobile && pathItem.type === T.FS.PathType.File && fileContext === FS.emptyFileContext
  const itemSave = (() => {
    if (!layout.saveMedia && !fileContextLoading) return []
    if (saving || fileContextLoading) {
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
            setView(T.FS.PathItemActionMenuView.ConfirmSaveMedia)
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
            setView(T.FS.PathItemActionMenuView.Share)
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
            path && navigateAppend({name: 'chatSendToChat', params: {sendPaths: [path]}})
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
          setView(T.FS.PathItemActionMenuView.ConfirmSendToOtherApp)
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

  const itemMoveOrCopy = layout.moveOrCopy
    ? ([
        {
          icon: 'iconfont-copy',
          onClick: hideAndCancelAfter(() => {
            navigateAppend({
              name: 'destinationPicker',
              params: {
                parentPath: T.FS.getPathParent(path),
                source: {path, type: T.FS.DestinationPickerSource.MoveOrCopy},
              },
            })
          }),
          title: 'Move or Copy',
        },
      ] as const)
    : []

  const ignoreNeedsToWait = C.Waiting.useAnyWaiting([C.waitingKeyFSFolderList, C.waitingKeyFSStat])
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
            navigateAppend({name: 'confirmDelete', params: {mode, path}})
          }),
          title: 'Delete',
        },
      ] as const)
    : []

  const onArchive =
    path && layout.archive && pathItem.type === T.FS.PathType.Folder
      ? () => {
          navigateAppend({
            name: 'archiveModal',
            params: {path, type: 'fsPath' as const},
          })
        }
      : undefined
  const itemArchive = onArchive
    ? ([
        {
          icon: 'iconfont-folder-downloads',
          onClick: hideAfter(() => onArchive()),
          title: 'Backup folder',
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
    ...itemMoveOrCopy,
    ...itemIgnore,
    ...itemRename,
    ...itemArchive,
    ...itemDelete,
  ]

  const justDoneWithIntent = Kbfs.useFsWatchDownloadForMobile(downloadID || '', downloadIntent)
  React.useEffect(() => {
    justDoneWithIntent && hide()
  }, [justDoneWithIntent, hide])

  const userInitiatedHide = () => {
    hide()
    downloadID && dismissDownload(downloadID)
  }

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
