// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type {FloatingMenuProps} from './types'
import {fileUIName} from '../../../constants/platform'
import Header from './header-container'

type ActionOrInProgress = (() => void) | 'in-progress'

type Props = {|
  floatingMenuProps: FloatingMenuProps,
  path: Types.Path,
  routePath: I.List<string>,
  shouldHideMenu: boolean,
  // menu items
  copyPath?: ?() => void,
  delete?: ?() => void,
  download?: ?() => void,
  ignoreTlf?: ?() => void,
  moveOrCopy?: ?() => void,
  saveMedia?: ?ActionOrInProgress,
  showInSystemFileManager?: ?() => void,
  // share menu items
  share?: ?() => void,
  sendAttachmentToChat?: ?() => void,
  sendLinkToChat?: ?() => void,
  sendToOtherApp?: ?ActionOrInProgress,
|}

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

const hideMenuOnClick = (onClick: (evt?: SyntheticEvent<>) => void, hideMenu: () => void) => (
  evt?: SyntheticEvent<>
) => {
  onClick(evt)
  hideMenu()
}

const makeMenuItems = (props: Props, hideMenu: () => void) => [
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
  ...(props.share
    ? [
        {
          onClick: props.share,
          title: 'Share',
        },
      ]
    : []),
  ...(props.sendLinkToChat
    ? [
        {
          onClick: () => {
            props.floatingMenuProps.hideOnce()
            // $FlowIssue doens't know sendLinkToChat can't be null here
            props.sendLinkToChat()
          },
          title: 'Send link to chat',
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
  ...(props.copyPath
    ? [
        {
          onClick: hideMenuOnClick(props.copyPath, hideMenu),
          title: 'Copy path',
        },
      ]
    : []),
  ...(props.download
    ? [
        {
          onClick: hideMenuOnClick(props.download, hideMenu),
          title: 'Download a copy',
        },
      ]
    : []),
  ...(props.ignoreTlf
    ? [
        {
          danger: true,
          onClick: hideMenuOnClick(props.ignoreTlf, hideMenu),
          subTitle: 'The folder will no longer appear in your folders list.',
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
    color: Styles.globalColors.blue,
  },
  menuRowTextDisabled: {
    color: Styles.globalColors.blue,
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
