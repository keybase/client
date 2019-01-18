// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import FollowButton from './follow-button'
import {normal as proofNormal} from '../constants/tracker'
import * as Styles from '../styles'
import type {SimpleProofState} from '../constants/types/tracker'
import flags from '../util/feature-flags'
import openUrl from '../util/open-url'

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
}: Props) {
  if (currentlyFollowing) {
    if (trackerState === proofNormal) {
      return (
        <Kb.ButtonBar style={style}>
          <FollowButton following={true} onUnfollow={onUnfollow} waitingKey="" />
          <Kb.Button type="Primary" label="Chat" onClick={onChat}>
            <Kb.Icon type="iconfont-chat" style={{marginRight: 8}} color={Styles.globalColors.white} />
          </Kb.Button>
          <DropdownButton
            onAddToTeam={onAddToTeam}
            onOpenPrivateFolder={onOpenPrivateFolder}
            onBrowsePublicFolder={onBrowsePublicFolder}
            onSendLumens={onSendLumens}
            onRequestLumens={onRequestLumens}
          />
        </Kb.ButtonBar>
      )
    } else {
      return (
        <Kb.ButtonBar style={style}>
          <Kb.Button type="Secondary" label="Refresh" onClick={onRefresh} />
          <Kb.Button type="PrimaryGreen" label="Accept" onClick={onAcceptProofs} />
          <DropdownButton
            onAddToTeam={onAddToTeam}
            onOpenPrivateFolder={onOpenPrivateFolder}
            onBrowsePublicFolder={onBrowsePublicFolder}
            onUnfollow={onUnfollow}
            onSendLumens={onSendLumens}
            onRequestLumens={onRequestLumens}
          />
        </Kb.ButtonBar>
      )
    }
  } else {
    return (
      <Kb.ButtonBar style={style}>
        <FollowButton following={false} onFollow={onFollow} waitingKey="" />
        <Kb.Button label="Chat" type="Primary" onClick={onChat} style={{marginRight: 0}}>
          <Kb.Icon type="iconfont-chat" style={{marginRight: 8}} color={Styles.globalColors.white} />
        </Kb.Button>
        <DropdownButton
          onAddToTeam={onAddToTeam}
          onOpenPrivateFolder={onOpenPrivateFolder}
          onBrowsePublicFolder={onBrowsePublicFolder}
          onSendLumens={onSendLumens}
          onRequestLumens={onRequestLumens}
        />
      </Kb.ButtonBar>
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
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.menuItemBox}>
              <Kb.Text
                center={Styles.isMobile}
                style={styles.menuItemText}
                type={Styles.isMobile ? 'BodyBig' : 'Body'}
              >
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
              <Kb.Text
                center={Styles.isMobile}
                style={styles.menuItemText}
                type={Styles.isMobile ? 'BodyBig' : 'Body'}
              >
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

const _DropdownButton = (props: DropdownProps & Kb.OverlayParentProps) => (
  <Kb.ClickableBox
    onClick={props.toggleShowingMenu}
    style={{backgroundColor: Styles.globalColors.white}}
    ref={props.setAttachmentRef}
  >
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
      <Kb.Button onClick={null} type="Secondary" style={iconButton}>
        <Kb.Icon
          color={Styles.globalColors.black_75}
          fontSize={Styles.isMobile ? 21 : 16}
          style={ellipsisIcon}
          type="iconfont-ellipsis"
        />
      </Kb.Button>
    </Kb.Box2>
    <Kb.FloatingMenu
      closeOnSelect={true}
      attachTo={props.getAttachmentRef}
      containerStyle={styles.floatingMenu}
      items={_makeDropdownButtonMenuItems(props)}
      onHidden={props.toggleShowingMenu}
      position="bottom right"
      visible={props.showingMenu}
    />
  </Kb.ClickableBox>
)

export type StellarFederatedAddressProps = {|
  currentlyFollowing?: boolean,
  stellarAddress: string,
  onSendOrRequest: (isRequest: boolean) => void,
  onCopyAddress: () => void,
|}

export const makeStellarAddressMenuItems = (props: StellarFederatedAddressProps) => [
  ...(Styles.isMobile
    ? [
        {
          title: 'Stellar Federated Address',
          view: (
            // eslint-disable-next-line no-use-before-define
            <Kb.Box2 direction="vertical" style={styles.menuItemBox}>
              <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.menuItemBox}>
                <Kb.Box style={styles.iconContainer}>
                  <Kb.Icon
                    style={styles.styleService}
                    color={styles.styleServiceContainer.color}
                    fontSize={20}
                    textAlign="center"
                    type={'iconfont-identity-stellar'}
                  />
                </Kb.Box>
                <Kb.Text type="BodySemibold" style={styles.styleServiceContainer}>
                  {props.stellarAddress}
                </Kb.Text>
              </Kb.Box2>
              <Kb.Text type="BodySmall" style={styles.styleServiceSubscript}>
                Stellar federated address
              </Kb.Text>
            </Kb.Box2>
          ),
        },
        'Divider',
      ]
    : []),
  {
    onClick: () => props.onSendOrRequest(false),
    title: 'Send Lumens (XLM)',
    view: (
      // eslint-disable-next-line no-use-before-define
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.menuItemBox}>
        <Kb.Text
          center={Styles.isMobile}
          style={styles.menuItemText}
          type={Styles.isMobile ? 'BodyBig' : 'Body'}
        >
          Send Lumens (XLM)
        </Kb.Text>
        <Kb.Meta title="New" size="Small" backgroundColor={Styles.globalColors.blue} style={styles.badge} />
      </Kb.Box2>
    ),
  },
  {
    onClick: () => props.onSendOrRequest(true),
    title: 'Request Lumens (XLM)',
    view: (
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.menuItemBox}>
        <Kb.Text
          center={Styles.isMobile}
          style={styles.menuItemText}
          type={Styles.isMobile ? 'BodyBig' : 'Body'}
        >
          Request Lumens (XLM)
        </Kb.Text>
        <Kb.Meta title="New" size="Small" backgroundColor={Styles.globalColors.blue} style={styles.badge} />
      </Kb.Box2>
    ),
  },
  {
    onClick: () => {
      props.onCopyAddress()
    },
    title: 'Copy address',
  },
  'Divider',
  {
    onClick: () => openUrl('https://keybase.io/what-is-stellar'),
    title: 'What is Stellar?',
  },
]

const ellipsisIcon = Styles.platformStyles({
  common: {
    position: 'relative',
    top: 1,
  },
})

const iconButton = Styles.platformStyles({
  isElectron: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  isMobile: {
    paddingLeft: 12,
    paddingRight: 12,
  },
})

const styles = Styles.styleSheetCreate({
  badge: {
    alignSelf: 'center',
  },
  floatingMenu: {
    marginTop: 4,
    width: 250,
  },
  iconContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: 32,
    minHeight: 32,
    minWidth: 28,
  },
  menuItemBox: Styles.platformStyles({
    isElectron: {
      justifyContent: 'space-between',
    },
    isMobile: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
  menuItemText: Styles.platformStyles({
    isMobile: {
      ...Styles.globalStyles.flexGrow,
      color: Styles.globalColors.blue,
    },
  }),
  styleService: {
    marginRight: Styles.globalMargins.xtiny,
    marginTop: 2,
    padding: 5,
  },
  styleServiceContainer: {
    color: Styles.globalColors.black_75,
  },
  styleServiceSubscript: {
    color: Styles.globalColors.black_50,
  },
})

const DropdownButton = Kb.OverlayParentHOC(_DropdownButton)

export default UserActions
