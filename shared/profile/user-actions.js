// @flow
import * as React from 'react'
import {
  Box2,
  Button,
  ClickableBox,
  FloatingMenu,
  FollowButton,
  ButtonBar,
  Icon,
  Meta,
  Text,
  OverlayParentHOC,
  type OverlayParentProps,
} from '../common-adapters'
import {normal as proofNormal} from '../constants/tracker'
import {globalColors, isMobile, platformStyles, styleSheetCreate} from '../styles'
import type {SimpleProofState} from '../constants/types/tracker'
import flags from '../util/feature-flags'

type Props = {|
  trackerState: SimpleProofState,
  currentlyFollowing: boolean,
  style: Object,
  onAddToTeam: () => void,
  onBrowsePublicFolder: () => void,
  onChat: () => void,
  onFollow: () => void,
  onOpenPrivateFolder: () => void,
  onRefresh: () => void,
  onSendLumens: () => void,
  onRequestLumens: () => void,
  onUnfollow: () => void,
  onAcceptProofs: () => void,
  waiting: boolean,
|}

function UserActions({
  trackerState,
  currentlyFollowing,
  style,
  onAddToTeam,
  onBrowsePublicFolder,
  onChat,
  onFollow,
  onOpenPrivateFolder,
  onRefresh,
  onSendLumens,
  onRequestLumens,
  onUnfollow,
  onAcceptProofs,
  waiting,
}: Props) {
  if (currentlyFollowing) {
    if (trackerState === proofNormal) {
      return (
        <ButtonBar style={style}>
          <FollowButton following={true} onUnfollow={onUnfollow} waiting={waiting} />
          <Button type="Primary" label="Chat" onClick={onChat}>
            <Icon type="iconfont-chat" style={{marginRight: 8}} color={globalColors.white} />
          </Button>
          <DropdownButton
            onAddToTeam={onAddToTeam}
            onOpenPrivateFolder={onOpenPrivateFolder}
            onBrowsePublicFolder={onBrowsePublicFolder}
            onSendLumens={onSendLumens}
            onRequestLumens={onRequestLumens}
          />
        </ButtonBar>
      )
    } else {
      return (
        <ButtonBar style={style}>
          <Button type="Secondary" label="Refresh" onClick={onRefresh} />
          <Button type="PrimaryGreen" label="Accept" onClick={onAcceptProofs} />
          <DropdownButton
            onAddToTeam={onAddToTeam}
            onOpenPrivateFolder={onOpenPrivateFolder}
            onBrowsePublicFolder={onBrowsePublicFolder}
            onUnfollow={onUnfollow}
            onSendLumens={onSendLumens}
            onRequestLumens={onRequestLumens}
          />
        </ButtonBar>
      )
    }
  } else {
    return (
      <ButtonBar style={style}>
        <FollowButton following={false} onFollow={onFollow} waiting={waiting} />
        <Button label="Chat" type="Primary" onClick={onChat} style={{marginRight: 0}}>
          <Icon type="iconfont-chat" style={{marginRight: 8}} color={globalColors.white} />
        </Button>
        <DropdownButton
          onAddToTeam={onAddToTeam}
          onOpenPrivateFolder={onOpenPrivateFolder}
          onBrowsePublicFolder={onBrowsePublicFolder}
          onSendLumens={onSendLumens}
          onRequestLumens={onRequestLumens}
        />
      </ButtonBar>
    )
  }
}

type DropdownProps = {
  onAddToTeam: () => void,
  onBrowsePublicFolder: () => void,
  onOpenPrivateFolder: () => void,
  onSendLumens: () => void,
  onRequestLumens: () => void,
  onUnfollow?: () => void,
}

const _makeDropdownButtonMenuItems = (props: DropdownProps) => [
  {
    onClick: props.onAddToTeam,
    title: 'Add to team...',
  },

  ...(flags.walletsEnabled
    ? [
        {
          onClick: props.onSendLumens,
          title: 'Send Lumens (XLM)',
          view: (
            <Box2 direction="horizontal" fullWidth={true} style={styles.menuItemBox}>
              <Text type="Body">Send Lumens (XLM)</Text>
              <Meta title="New" size="Small" backgroundColor={globalColors.blue} style={styles.badge} />
            </Box2>
          ),
        },
        {
          onClick: props.onRequestLumens,
          title: 'Request Lumens (XLM)',
          view: (
            <Box2 direction="horizontal" fullWidth={true} style={styles.menuItemBox}>
              <Text type="Body">Request Lumens (XLM)</Text>
              <Meta title="New" size="Small" backgroundColor={globalColors.blue} style={styles.badge} />
            </Box2>
          ),
        },
      ]
    : []),

  ...(!isMobile
    ? [
        {
          onClick: props.onOpenPrivateFolder,
          title: 'Open private folder',
        },
        {
          onClick: props.onBrowsePublicFolder,
          title: 'Browse public folder',
        },
      ]
    : []),

  ...(props.onUnfollow
    ? [
        {
          onClick: props.onUnfollow && props.onUnfollow,
          style: {
            borderTopWidth: 0,
          },
          title: 'Unfollow',
        },
      ]
    : []),
]

const _DropdownButton = (props: DropdownProps & OverlayParentProps) => (
  <ClickableBox
    onClick={props.toggleShowingMenu}
    style={{backgroundColor: globalColors.white}}
    ref={props.setAttachmentRef}
  >
    <Box2 direction="horizontal" fullWidth={true} gap="xsmall">
      <Button onClick={null} type="Secondary" style={iconButton}>
        <Icon
          color={globalColors.black_75}
          fontSize={isMobile ? 21 : 16}
          style={ellipsisIcon}
          type="iconfont-ellipsis"
        />
      </Button>
    </Box2>
    <FloatingMenu
      closeOnSelect={true}
      attachTo={props.getAttachmentRef}
      containerStyle={styles.floatingMenu}
      items={_makeDropdownButtonMenuItems(props)}
      onHidden={props.toggleShowingMenu}
      position="bottom right"
      visible={props.showingMenu}
    />
  </ClickableBox>
)

const ellipsisIcon = platformStyles({
  common: {
    position: 'relative',
    top: 1,
  },
})

const iconButton = platformStyles({
  isElectron: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  isMobile: {
    paddingLeft: 12,
    paddingRight: 12,
  },
})

const styles = styleSheetCreate({
  badge: {
    alignSelf: 'center',
  },
  floatingMenu: {
    marginTop: 4,
    width: 250,
  },
  menuItemBox: {
    justifyContent: 'space-between',
  },
})

const DropdownButton = OverlayParentHOC(_DropdownButton)

export default UserActions
