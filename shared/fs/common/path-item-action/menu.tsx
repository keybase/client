import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Kb from '../../../common-adapters'
import * as Constants from '../../../constants/fs'
import * as Kbfs from '../../common/hooks'
import type {FloatingMenuProps} from './types'
import {fileUIName} from '../../../constants/platform'
import Header from './header'

type ActionOrInProgress = (() => void) | 'in-progress'

type Props = {
  floatingMenuProps: FloatingMenuProps
  path: Types.Path
  copyPath?: () => void
  delete?: () => void
  download?: () => void
  ignoreTlf?: (() => void) | 'disabled'
  moveOrCopy?: () => void
  me: string
  newFolder?: () => void
  openChatNonTeam?: () => void
  openChatTeam?: () => void
  pathItemType: Types.PathType
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
      ? [
          {
            icon: 'iconfont-folder-new',
            onClick: hideMenuOnClick(props.newFolder, hideMenu),
            title: 'New folder',
          },
        ]
      : []),
    ...(props.openChatTeam
      ? [
          {
            icon: 'iconfont-chat',
            onClick: hideMenuOnClick(props.openChatTeam, hideMenu),
            title: 'Chat with team',
          },
        ]
      : []),
    ...(props.openChatNonTeam
      ? [
          {
            icon: 'iconfont-chat',
            onClick: hideMenuOnClick(props.openChatNonTeam, hideMenu),
            title: 'Chat with them',
          },
        ]
      : []),
    ...(props.showInSystemFileManager
      ? [
          {
            icon: 'iconfont-finder',
            onClick: hideMenuOnClick(props.showInSystemFileManager, hideMenu),
            title: 'Show in ' + fileUIName,
          },
        ]
      : []),
    ...(props.saveMedia
      ? [
          {
            disabled: props.saveMedia === 'in-progress',
            icon: 'iconfont-download-2',
            inProgress: props.saveMedia === 'in-progress',
            onClick: props.saveMedia !== 'in-progress' ? props.saveMedia : undefined,
            title: 'Save',
          },
        ]
      : []),
    ...(props.copyPath
      ? [
          {
            icon: 'iconfont-clipboard',
            onClick: hideMenuOnClick(props.copyPath, hideMenu),
            title: 'Copy universal path',
          },
        ]
      : []),
    ...(props.share
      ? [
          {
            icon: 'iconfont-share',
            onClick: props.share,
            title: 'Share...',
          },
        ]
      : []),
    ...(props.sendAttachmentToChat
      ? [
          {
            icon: 'iconfont-chat',
            onClick: () => {
              props.floatingMenuProps.hide()
              props.sendAttachmentToChat && props.sendAttachmentToChat()
            },
            subTitle: `The ${
              props.pathItemType === Types.PathType.Folder ? 'folder' : 'file'
            } will be sent as an attachment.`,
            title: 'Attach in another conversation',
          },
        ]
      : []),
    ...(props.sendToOtherApp
      ? [
          {
            disabled: props.sendToOtherApp === 'in-progress',
            icon: 'iconfont-share',
            inProgress: props.saveMedia === 'in-progress',
            onClick: props.sendToOtherApp !== 'in-progress' ? props.sendToOtherApp : undefined,
            title: 'Send to another app',
          },
        ]
      : []),
    ...(props.download
      ? [
          {
            icon: 'iconfont-download-2',
            onClick: hideMenuOnClick(props.download, hideMenu),
            title: 'Download',
          },
        ]
      : []),
    ...(props.ignoreTlf
      ? [
          {
            danger: true,
            disabled: props.ignoreTlf === 'disabled',
            icon: 'iconfont-hide',
            onClick: props.ignoreTlf === 'disabled' ? undefined : hideMenuOnClick(props.ignoreTlf, hideMenu),
            progressIndicator: props.ignoreTlf === 'disabled',
            subTitle: 'Will hide the folder from your list.',
            title: 'Ignore this folder',
          },
        ]
      : []),
    ...(props.rename
      ? [
          {
            icon: 'iconfont-edit',
            onClick: hideMenuOnClick(props.rename, hideMenu),
            title: 'Rename',
          },
        ]
      : []),
    ...(props.moveOrCopy
      ? [
          {
            icon: 'iconfont-copy',
            onClick: hideMenuOnClick(props.moveOrCopy, hideMenu),
            title: 'Move or Copy',
          },
        ]
      : []),
    ...(props.delete
      ? [
          {
            danger: true,
            icon: 'iconfont-trash',
            onClick: hideMenuOnClick(props.delete, hideMenu),
            title: 'Delete',
          },
        ]
      : []),
  ].reduce<Kb.MenuItems>((arr, i) => {
    i && arr.push(i as Kb.MenuItem)
    return arr
  }, [])
  return items.length ? ['Divider' as const, ...items] : items
}

const PathItemActionMenu = (props: Props) => {
  Kbfs.useFsFileContext(props.path)
  const {downloadID, downloadIntent} = Constants.useState(s => s.pathItemActionMenu)
  const justDoneWithIntent = Kbfs.useFsWatchDownloadForMobile(downloadID || '', downloadIntent)

  const dismissDownload = Constants.useState(s => s.dispatch.dismissDownload)
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
