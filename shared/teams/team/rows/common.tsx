import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type * as React from 'react'
import MenuHeader from './menu-header'

// the explanatory blueGrey footer row at the bottom of the channels/subteams tabs
export const InfoNoteRow = (props: {children: React.ReactNode}) => (
  <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={infoNoteStyles.container}>
    <Kb.InfoNote>{props.children}</Kb.InfoNote>
  </Kb.Box2>
)

export const infoNoteStyles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.large, Kb.Styles.globalMargins.medium),
    backgroundColor: Kb.Styles.globalColors.blueGrey,
  },
  text: {
    maxWidth: 326,
  },
}))

// styles shared by the selectable member/channel rows
export const selectionStyles = Kb.Styles.styleSheetCreate(() => ({
  checkCircle: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
    alignSelf: 'center',
  },
  fullNameLabel: {flexShrink: 1},
  listItemMargin: {marginLeft: 0},
  mobileMarginsHack: Kb.Styles.platformStyles({isMobile: {marginRight: 48}}), // ListItem is malfunctioning because the checkbox width is unusual
  nameContainer: {marginLeft: Kb.Styles.globalMargins.small},
  selected: {backgroundColor: Kb.Styles.globalColors.blueLighterOrBlueDarker},
  unselected: {backgroundColor: Kb.Styles.globalColors.white},
  widenClickableArea: {margin: -5, padding: 5},
}))

export const getResetLabel = (status: T.Teams.MemberStatus, youCanManageMembers: boolean) =>
  status === 'deleted'
    ? 'Has deleted their account'
    : youCanManageMembers
      ? 'Has reset their account'
      : 'Has reset their account; admins can re-invite'

export const FullNameLabel = (props: {fullName: string; active: boolean}) =>
  props.fullName && props.active ? (
    <Kb.Text style={selectionStyles.fullNameLabel} type="BodySmall" lineClamp={1}>
      {props.fullName} •
    </Kb.Text>
  ) : null

// ListItem props that swap the leading icon for a mass-selection check circle
export const getMassActionsProps = (username: string, selected: boolean, onSelect: (s: boolean) => void) => ({
  containerStyleOverride: selectionStyles.listItemMargin,
  icon: (
    <Kb.CheckCircle
      checked={selected}
      onCheck={onSelect}
      key={`check-${username}`}
      style={selectionStyles.widenClickableArea}
    />
  ),
  iconStyleOverride: selectionStyles.checkCircle,
})

export const useOnBlockUser = (username: string) => {
  const setUserBlocks = C.useRPC(T.RPCGen.userSetUserBlocksRpcPromise)
  return () => {
    if (username) {
      setUserBlocks(
        [{blocks: [{setChatBlock: true, setFollowBlock: true, username}]}, C.waitingKeyUsersSetUserBlocks],
        () => {},
        () => {}
      )
    }
  }
}

type MemberMenuProps = {
  blockIcon: Kb.IconType
  canEditRole: boolean
  crown: React.ReactNode
  fullName: string
  isYou: boolean
  onAddToChannels: () => void
  onBlock: () => void
  onChat: () => void
  onEditRole: () => void
  onOpenProfile: () => void
  removeItem?: {title: string; onClick: () => void}
  roleLabel: React.ReactNode
  username: string
  youCanManageMembers: boolean
}

// the chat/ellipsis hover actions incl. the "More actions" floating menu, shared
// by the team-members and channel-members rows
export const MemberActions = (props: MemberMenuProps) => {
  const {blockIcon, canEditRole, crown, fullName, isYou, onAddToChannels, onBlock, onChat} = props
  const {onEditRole, onOpenProfile, removeItem, roleLabel, username, youCanManageMembers} = props
  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    const menuHeader = (
      <MenuHeader
        username={username}
        fullName={fullName}
        label={
          <Kb.Box2 direction="horizontal">
            <Kb.Text type="BodySmall">{crown}</Kb.Text>
            <Kb.Text type="BodySmall">{roleLabel}</Kb.Text>
          </Kb.Box2>
        }
      />
    )

    const menuItems: Kb.MenuItems = [
      'Divider',
      ...(youCanManageMembers
        ? ([
            {
              icon: 'iconfont-chat',
              onClick: onAddToChannels,
              title: 'Add to channels...',
            },
            ...(canEditRole
              ? [{icon: 'iconfont-crown-admin', onClick: onEditRole, title: 'Edit role...'}]
              : []),
          ] as Kb.MenuItems)
        : []),
      {icon: 'iconfont-person', onClick: onOpenProfile, title: 'View profile'},
      {icon: 'iconfont-chat', onClick: onChat, title: 'Chat'},
      ...(youCanManageMembers || !isYou ? (['Divider'] as Kb.MenuItems) : []),
      ...(removeItem
        ? ([
            {
              danger: true,
              icon: 'iconfont-remove',
              onClick: removeItem.onClick,
              title: removeItem.title,
            },
          ] as Kb.MenuItems)
        : []),
      ...(!isYou
        ? ([
            {
              danger: true,
              icon: blockIcon,
              onClick: onBlock,
              title: 'Block',
            },
          ] as Kb.MenuItems)
        : []),
    ]
    return (
      <Kb.FloatingMenu
        header={menuHeader}
        attachTo={attachTo}
        closeOnSelect={true}
        items={menuItems}
        onHidden={hidePopup}
        visible={true}
      />
    )
  }
  const {showPopup, popupAnchor, popup} = Kb.usePopup2(makePopup)

  return (
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      style={youCanManageMembers ? selectionStyles.mobileMarginsHack : undefined}
    >
      {popup}
      <Kb.IconButton
        icon="iconfont-chat"
        iconColor={Kb.Styles.globalColors.black_50}
        mode="Secondary"
        onClick={onChat}
        small={true}
        tooltip="Open chat"
      />
      <Kb.IconButton
        icon="iconfont-ellipsis"
        iconColor={Kb.Styles.globalColors.black_50}
        mode="Secondary"
        onClick={showPopup}
        ref={popupAnchor}
        small={true}
        tooltip="More actions"
      />
    </Kb.Box2>
  )
}
