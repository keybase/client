import * as C from '../../../constants'
import * as React from 'react'
import * as T from '../../../constants/types'
import * as Kb from '../../../common-adapters'
import * as Kbfs from '../../common/hooks'
import type {FloatingMenuProps} from './types'
import Header from './header'

type ActionOrInProgress = (() => void) | 'in-progress'

type Props = {
  floatingMenuProps: FloatingMenuProps
  path: T.FS.Path
  copyPath?: () => void
  delete?: () => void
  download?: () => void
  ignoreTlf?: (() => void) | 'disabled'
  moveOrCopy?: () => void
  me: string
  newFolder?: () => void
  openChatNonTeam?: () => void
  openChatTeam?: () => void
  pathItemType: T.FS.PathType
  rename?: () => void
  saveMedia?: ActionOrInProgress
  showInSystemFileManager?: () => void
  share?: () => void
  sendAttachmentToChat?: () => void
  sendToOtherApp?: ActionOrInProgress
}

const hideMenuOnClick =
  (onClick: (evt?: React.SyntheticEvent) => void, hideMenu: () => void) => (evt?: React.SyntheticEvent) => {
    onClick(evt)
    hideMenu()
  }

const makeMenuItems = (props: Props, hideMenu: () => void) => {
  const items: Kb.MenuItems = [
    ...(props.newFolder
      ? ([
          {
            icon: 'iconfont-folder-new',
            onClick: hideMenuOnClick(props.newFolder, hideMenu),
            title: 'New folder',
          },
        ] as const)
      : []),
    ...(props.openChatTeam
      ? ([
          {
            icon: 'iconfont-chat',
            onClick: hideMenuOnClick(props.openChatTeam, hideMenu),
            title: 'Chat with team',
          },
        ] as const)
      : []),
    ...(props.openChatNonTeam
      ? ([
          {
            icon: 'iconfont-chat',
            onClick: hideMenuOnClick(props.openChatNonTeam, hideMenu),
            title: 'Chat with them',
          },
        ] as const)
      : []),
    ...(props.showInSystemFileManager
      ? ([
          {
            icon: 'iconfont-finder',
            onClick: hideMenuOnClick(props.showInSystemFileManager, hideMenu),
            title: 'Show in ' + C.fileUIName,
          },
        ] as const)
      : []),
    ...(props.saveMedia
      ? ([
          {
            disabled: props.saveMedia === 'in-progress',
            icon: 'iconfont-download-2',
            inProgress: props.saveMedia === 'in-progress',
            onClick: props.saveMedia !== 'in-progress' ? props.saveMedia : undefined,
            title: 'Save',
          },
        ] as const)
      : []),
    ...(props.copyPath
      ? ([
          {
            icon: 'iconfont-clipboard',
            onClick: hideMenuOnClick(props.copyPath, hideMenu),
            title: 'Copy universal path',
          },
        ] as const)
      : []),
    ...(props.share
      ? ([
          {
            icon: 'iconfont-share',
            onClick: props.share,
            title: 'Share...',
          },
        ] as const)
      : []),
    ...(props.sendAttachmentToChat
      ? ([
          {
            icon: 'iconfont-chat',
            onClick: () => {
              props.floatingMenuProps.hide()
              props.sendAttachmentToChat && props.sendAttachmentToChat()
            },
            subTitle: `The ${
              props.pathItemType === T.FS.PathType.Folder ? 'folder' : 'file'
            } will be sent as an attachment.`,
            title: 'Attach in another conversation',
          },
        ] as const)
      : []),
    ...(props.sendToOtherApp
      ? ([
          {
            disabled: props.sendToOtherApp === 'in-progress',
            icon: 'iconfont-share',
            inProgress: props.saveMedia === 'in-progress',
            onClick: props.sendToOtherApp !== 'in-progress' ? props.sendToOtherApp : undefined,
            title: 'Send to another app',
          },
        ] as const)
      : []),
    ...(props.download
      ? ([
          {
            icon: 'iconfont-download-2',
            onClick: hideMenuOnClick(props.download, hideMenu),
            title: 'Download',
          },
        ] as const)
      : []),
    ...(props.ignoreTlf
      ? ([
          {
            danger: true,
            disabled: props.ignoreTlf === 'disabled',
            icon: 'iconfont-hide',
            onClick: props.ignoreTlf === 'disabled' ? undefined : hideMenuOnClick(props.ignoreTlf, hideMenu),
            progressIndicator: props.ignoreTlf === 'disabled',
            subTitle: 'Will hide the folder from your list.',
            title: 'Ignore this folder',
          },
        ] as const)
      : []),
    ...(props.rename
      ? ([
          {
            icon: 'iconfont-edit',
            onClick: hideMenuOnClick(props.rename, hideMenu),
            title: 'Rename',
          },
        ] as const)
      : []),
    ...(props.moveOrCopy
      ? ([
          {
            icon: 'iconfont-copy',
            onClick: hideMenuOnClick(props.moveOrCopy, hideMenu),
            title: 'Move or Copy',
          },
        ] as const)
      : []),
    ...(props.delete
      ? ([
          {
            danger: true,
            icon: 'iconfont-trash',
            onClick: hideMenuOnClick(props.delete, hideMenu),
            title: 'Delete',
          },
        ] as const)
      : []),
  ]
  return items.length ? ['Divider' as const, ...items] : items
}

const PathItemActionMenu = (props: Props) => {
  Kbfs.useFsFileContext(props.path)
  const {downloadID, downloadIntent} = C.useFSState(s => s.pathItemActionMenu)
  const justDoneWithIntent = Kbfs.useFsWatchDownloadForMobile(downloadID || '', downloadIntent)

  const dismissDownload = C.useFSState(s => s.dispatch.dismissDownload)
  const {
    floatingMenuProps: {hide},
  } = props

  React.useEffect(() => {
    justDoneWithIntent && hide()
  }, [justDoneWithIntent, hide])

  const userInitiatedHide = React.useCallback(() => {
    hide()
    downloadID && dismissDownload(downloadID)
  }, [downloadID, hide, dismissDownload])

  return (
    <Kb.FloatingMenu
      closeText="Cancel"
      closeOnSelect={false}
      containerStyle={props.floatingMenuProps.containerStyle}
      attachTo={props.floatingMenuProps.attachTo}
      visible={props.floatingMenuProps.visible}
      onHidden={userInitiatedHide}
      position="left center"
      header={<Header path={props.path} />}
      items={makeMenuItems(props, props.floatingMenuProps.hide)}
    />
  )
}
export default PathItemActionMenu
