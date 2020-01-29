import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Kbfs from '../../common'
import * as FsGen from '../../../actions/fs-gen'
import {FloatingMenuProps} from './types'
import {fileUIName} from '../../../constants/platform'
import Header from './header'

type ActionOrInProgress = (() => void) | 'in-progress'

type Props = {
  floatingMenuProps: FloatingMenuProps
  path: Types.Path
  copyPath?: (() => void) | null
  delete?: (() => void) | null
  download?: (() => void) | null
  ignoreTlf?: (() => void) | 'disabled' | null
  moveOrCopy?: (() => void) | null
  me: string
  newFolder?: (() => void) | null
  openChatNonTeam?: (() => void) | null
  openChatTeam?: (() => void) | null
  pathItemType: Types.PathType
  saveMedia?: ActionOrInProgress | null
  showInSystemFileManager?: (() => void) | null
  share?: (() => void) | null
  sendAttachmentToChat?: (() => void) | null
  sendToOtherApp?: ActionOrInProgress | null
}

const hideMenuOnClick = (onClick: (evt?: React.SyntheticEvent) => void, hideMenu: () => void) => (
  evt?: React.SyntheticEvent
) => {
  onClick(evt)
  hideMenu()
}

const makeMenuItems = (props: Props, hideMenu: () => void) => {
  const items: Kb.MenuItems = [
    ...(props.newFolder
      ? [
          {
            icon: Kb.IconType.iconfont_folder_new,
            onClick: hideMenuOnClick(props.newFolder, hideMenu),
            title: 'New folder',
          },
        ]
      : []),
    ...(props.openChatTeam
      ? [
          {
            icon: Kb.IconType.iconfont_chat,
            onClick: hideMenuOnClick(props.openChatTeam, hideMenu),
            title: 'Chat with team',
          },
        ]
      : []),
    ...(props.openChatNonTeam
      ? [
          {
            icon: Kb.IconType.iconfont_chat,
            onClick: hideMenuOnClick(props.openChatNonTeam, hideMenu),
            title: 'Chat with them',
          },
        ]
      : []),
    ...(props.showInSystemFileManager
      ? [
          {
            icon: Kb.IconType.iconfont_finder,
            onClick: hideMenuOnClick(props.showInSystemFileManager, hideMenu),
            title: 'Show in ' + fileUIName,
          },
        ]
      : []),
    ...(props.saveMedia
      ? [
          {
            disabled: props.saveMedia === 'in-progress',
            icon: Kb.IconType.iconfont_download_2,
            inProgress: props.saveMedia === 'in-progress',
            onClick: props.saveMedia !== 'in-progress' ? props.saveMedia : undefined,
            title: 'Save',
          },
        ]
      : []),
    ...(props.copyPath
      ? [
          {
            icon: Kb.IconType.iconfont_clipboard,
            onClick: hideMenuOnClick(props.copyPath, hideMenu),
            title: 'Copy universal path',
          },
        ]
      : []),
    ...(props.share
      ? [
          {
            icon: Kb.IconType.iconfont_share,
            onClick: props.share,
            title: 'Share...',
          },
        ]
      : []),
    ...(props.sendAttachmentToChat
      ? [
          {
            icon: Kb.IconType.iconfont_chat,
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
            icon: Kb.IconType.iconfont_share,
            inProgress: props.saveMedia === 'in-progress',
            onClick: props.sendToOtherApp !== 'in-progress' ? props.sendToOtherApp : undefined,
            title: 'Send to another app',
          },
        ]
      : []),
    ...(props.download
      ? [
          {
            icon: Kb.IconType.iconfont_download_2,
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
            icon: Kb.IconType.iconfont_hide,
            onClick: props.ignoreTlf === 'disabled' ? undefined : hideMenuOnClick(props.ignoreTlf, hideMenu),
            progressIndicator: props.ignoreTlf === 'disabled',
            subTitle: 'Will hide the folder from your list.',
            title: 'Ignore this folder',
          },
        ]
      : []),
    ...(props.moveOrCopy
      ? [
          {
            icon: Kb.IconType.iconfont_copy,
            onClick: hideMenuOnClick(props.moveOrCopy, hideMenu),
            title: 'Move or Copy',
          },
        ]
      : []),
    ...(props.delete
      ? [
          {
            danger: true,
            icon: Kb.IconType.iconfont_trash,
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

export default (props: Props) => {
  Kbfs.useFsFileContext(props.path)
  const {downloadID, downloadIntent} = Container.useSelector(state => state.fs.pathItemActionMenu)
  const justDoneWithIntent = Kbfs.useFsWatchDownloadForMobile(downloadID || '', downloadIntent)

  const {
    floatingMenuProps: {hide},
  } = props

  React.useEffect(() => {
    justDoneWithIntent && hide()
  }, [justDoneWithIntent, hide])

  const dispatch = Kbfs.useDispatchWhenKbfsIsConnected()
  const userInitiatedHide = React.useCallback(() => {
    hide()
    downloadID && dispatch(FsGen.createDismissDownload({downloadID}))
  }, [downloadID, hide, dispatch])

  return (
    <Kb.FloatingMenu
      closeText="Cancel"
      closeOnSelect={false}
      containerStyle={props.floatingMenuProps.containerStyle}
      attachTo={props.floatingMenuProps.attachTo}
      visible={props.floatingMenuProps.visible}
      onHidden={userInitiatedHide}
      position="left center"
      header={{
        title: 'unused',
        view: <Header path={props.path} />,
      }}
      items={makeMenuItems(props, props.floatingMenuProps.hide)}
    />
  )
}
