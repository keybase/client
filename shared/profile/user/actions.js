// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
// import * as Types from '../../constants/types/tracker2'
import * as Constants from '../../constants/tracker2'
import FollowButton from '../follow-button'
import * as Styles from '../../styles'
import flags from '../../util/feature-flags'
import type {Props} from '.'

const Actions = (p: Props) => {
  let buttons = []

  const dropdown = null /* (
    <DropdownButton
      onAddToTeam={onAddToTeam}
      onOpenPrivateFolder={onOpenPrivateFolder}
      onBrowsePublicFolder={onBrowsePublicFolder}
      onSendLumens={onSendLumens}
      onRequestLumens={onRequestLumens}
    />
  ) */

  const chatButton = (
    <Kb.WaitingButton
      type="Primary"
      key="Chat"
      label="Chat"
      waitingKey={Constants.waitingKey}
      onClick={p.onChat}
    >
      <Kb.Icon type="iconfont-chat" color={Styles.globalColors.white} style={styles.chatIcon} />
    </Kb.WaitingButton>
  )

  if (p.followThem) {
    if (p.state === 'valid') {
      buttons = [
        <FollowButton
          key="unfollow"
          following={true}
          onUnfollow={p.onUnfollow}
          waitingKey={Constants.waitingKey}
        />,
        chatButton,
        dropdown,
      ]
    } else {
      buttons = [
        <Kb.WaitingButton
          type="Primary"
          key="Reload"
          label="Reload"
          waitingKey={Constants.waitingKey}
          onClick={p.onReload}
        />,
        <Kb.WaitingButton
          type="PrimaryGreen"
          key="Accept"
          label="Accept"
          waitingKey={Constants.waitingKey}
          onClick={p.onAccept}
        />,
        dropdown,
      ]
    }
  } else {
    buttons = [
      <FollowButton key="follow" following={false} onFollow={p.onFollow} waitingKey={Constants.waitingKey} />,
      chatButton,
      dropdown,
    ]
  }

  return (
    <Kb.Box2 gap="small" centerChildren={true} direction="horizontal" fullWidth={true}>
      {buttons}
    </Kb.Box2>
  )
}

const makeDropdownButtonMenuItems = props => [
  {onClick: props.onAddToTeam, title: 'Add to team...'},
  ...(flags.walletsEnabled
    ? [
        {
          onClick: props.onSendLumens,
          title: 'Send Lumens (XLM)',
          view: (
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.menuItemBox}>
              <Kb.Text style={styles.menuItemText} type={Styles.isMobile ? 'BodyBig' : 'Body'}>
                Send Lumens (XLM)
              </Kb.Text>
              <Kb.Meta
                title="New"
                size="Small"
                backgroundColor={Styles.globalColors.blue}
                style={styles.badge}
              />
            </Kb.Box2>
          ),
        },
        {
          onClick: props.onRequestLumens,
          title: 'Request Lumens (XLM)',
          view: (
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.menuItemBox}>
              <Kb.Text style={styles.menuItemText} type={Styles.isMobile ? 'BodyBig' : 'Body'}>
                Request Lumens (XLM)
              </Kb.Text>
              <Kb.Meta
                title="New"
                size="Small"
                backgroundColor={Styles.globalColors.blue}
                style={styles.badge}
              />
            </Kb.Box2>
          ),
        },
      ]
    : []),
  ...(!Styles.isMobile
    ? [
        {onClick: props.onOpenPrivateFolder, title: 'Open private folder'},
        {onClick: props.onBrowsePublicFolder, title: 'Browse public folder'},
      ]
    : []),
  ...(props.onUnfollow
    ? [{onClick: props.onUnfollow && props.onUnfollow, style: {borderTopWidth: 0}, title: 'Unfollow'}]
    : []),
]

// const _DropdownButton = props => (
// <Kb.ClickableBox
// onClick={props.toggleShowingMenu}
// style={{backgroundColor: Styles.globalColors.white}}
// ref={props.setAttachmentRef}
// >
// <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
// <Kb.Button onClick={null} type="Secondary" style={iconButton}>
// <Kb.Icon
// color={Styles.globalColors.black_75}
// fontSize={Styles.isMobile ? 21 : 16}
// style={ellipsisIcon}
// type="iconfont-ellipsis"
// />
// </Kb.Button>
// </Kb.Box2>
// <Kb.FloatingMenu
// closeOnSelect={true}
// attachTo={props.getAttachmentRef}
// containerStyle={styles.floatingMenu}
// items={makeDropdownButtonMenuItems(props)}
// onHidden={props.toggleShowingMenu}
// position="bottom right"
// visible={props.showingMenu}
// />
// </Kb.ClickableBox>
// )

const styles = Styles.styleSheetCreate({})

export default Actions
