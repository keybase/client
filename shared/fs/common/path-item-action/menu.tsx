import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {FloatingMenuProps} from './types'
import {fileUIName} from '../../../constants/platform'
import Header from './header-container'

type ActionOrInProgress = (() => void) | 'in-progress'

type Props = {
  floatingMenuProps: FloatingMenuProps
  path: Types.Path
  shouldHideMenu: boolean
  copyPath?: (() => void) | null
  delete?: (() => void) | null
  download?: (() => void) | null
  ignoreTlf?: (() => void) | null
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
  sendLinkToChat?: (() => void) | null
  sendToOtherApp?: ActionOrInProgress | null
}

const InProgressMenuEntry = ({text}) => (
  <Kb.Box2 direction="horizontal">
    <Kb.Text type="BodyBig" style={styles.menuRowTextDisabled}>
      {text}
    </Kb.Text>
    <Kb.ProgressIndicator style={styles.progressIndicator} />
  </Kb.Box2>
)

const ActionableMenuEntry = ({text}) => (
  <Kb.Text type="BodyBig" style={styles.menuRowText}>
    {text}
  </Kb.Text>
)

const hideMenuOnClick = (onClick: (evt?: React.SyntheticEvent) => void, hideMenu: () => void) => (
  evt?: React.SyntheticEvent
) => {
  onClick(evt)
  hideMenu()
}

const makeMenuItems = (props: Props, hideMenu: () => void) => [
  'Divider' as const,
  ...(props.newFolder
    ? [
        {
          onClick: hideMenuOnClick(props.newFolder, hideMenu),
          title: 'New folder',
        },
      ]
    : []),
  ...(props.openChatTeam
    ? [
        {
          onClick: hideMenuOnClick(props.openChatTeam, hideMenu),
          title: 'Chat with team',
        },
      ]
    : []),
  ...(props.openChatNonTeam
    ? [
        {
          onClick: hideMenuOnClick(props.openChatNonTeam, hideMenu),
          title: 'Chat with them',
        },
      ]
    : []),
  ...(props.showInSystemFileManager
    ? [
        {
          onClick: hideMenuOnClick(props.showInSystemFileManager, hideMenu),
          title: 'Show in ' + fileUIName,
        },
      ]
    : []),
  ...(props.saveMedia
    ? [
        {
          disabled: props.saveMedia === 'in-progress',
          onClick: props.saveMedia !== 'in-progress' ? props.saveMedia : undefined,
          title: 'Save',
          view:
            props.saveMedia === 'in-progress' ? (
              <InProgressMenuEntry text="Save" />
            ) : (
              <ActionableMenuEntry text="Save" />
            ),
        },
      ]
    : []),
  ...(props.copyPath
    ? [
        {
          onClick: hideMenuOnClick(props.copyPath, hideMenu),
          title: 'Copy path',
        },
      ]
    : []),
  ...(props.share
    ? [
        {
          onClick: props.share,
          title: 'Share...',
        },
      ]
    : []),
  ...(props.sendLinkToChat
    ? [
        {
          onClick: () => {
            props.floatingMenuProps.hideOnce()
            props.sendLinkToChat && props.sendLinkToChat()
          },
          subTitle: `The ${
            props.pathItemType === Types.PathType.Folder ? 'folder' : 'file'
          } will be sent as a link.`,
          title: `Send to ${Constants.getChatTarget(props.path, props.me)}`,
        },
      ]
    : []),
  ...(props.sendAttachmentToChat
    ? [
        {
          onClick: () => {
            props.floatingMenuProps.hideOnce()
            props.sendAttachmentToChat && props.sendAttachmentToChat()
          },
          subTitle: `The ${
            props.pathItemType === Types.PathType.Folder ? 'folder' : 'file'
          } will be sent as an attachment.`,
          title: 'Attach in other conversation',
        },
      ]
    : []),
  ...(props.sendToOtherApp
    ? [
        {
          disabled: props.sendToOtherApp === 'in-progress',
          onClick: props.sendToOtherApp !== 'in-progress' ? props.sendToOtherApp : undefined,
          title: 'Send to other app',
          view:
            props.sendToOtherApp === 'in-progress' ? (
              <InProgressMenuEntry text="Send to other app" />
            ) : (
              <ActionableMenuEntry text="Send to other app" />
            ),
        },
      ]
    : []),
  ...(props.download
    ? [
        {
          onClick: hideMenuOnClick(props.download, hideMenu),
          title: 'Download',
        },
      ]
    : []),
  ...(props.ignoreTlf
    ? [
        {
          danger: true,
          onClick: hideMenuOnClick(props.ignoreTlf, hideMenu),
          subTitle: 'Will hide the folder from your list.',
          title: 'Ignore this folder',
        },
      ]
    : []),
  ...(props.moveOrCopy
    ? [
        {
          onClick: hideMenuOnClick(props.moveOrCopy, hideMenu),
          title: 'Move or Copy',
        },
      ]
    : []),
  ...(props.delete
    ? [
        {
          danger: true,
          onClick: hideMenuOnClick(props.delete, hideMenu),
          title: 'Delete',
        },
      ]
    : []),
]

export default (props: Props) => {
  props.shouldHideMenu && props.floatingMenuProps.hideOnce()
  return (
    <Kb.FloatingMenu
      closeText="Cancel"
      closeOnSelect={false}
      containerStyle={props.floatingMenuProps.containerStyle}
      attachTo={props.floatingMenuProps.attachTo}
      visible={props.floatingMenuProps.visible}
      onHidden={props.floatingMenuProps.hideOnce}
      position="bottom right"
      header={{
        title: 'unused',
        view: <Header path={props.path} />,
      }}
      items={makeMenuItems(props, props.floatingMenuProps.hideOnce)}
    />
  )
}

const styles = Styles.styleSheetCreate({
  menuRowText: {
    color: Styles.globalColors.blueDark,
  },
  menuRowTextDisabled: {
    color: Styles.globalColors.blueDark,
    opacity: 0.6,
  },
  progressIndicator: {
    bottom: 0,
    left: 0,
    marginRight: Styles.globalMargins.xtiny,
    position: 'absolute',
    right: 0,
    top: 0,
  },
})
