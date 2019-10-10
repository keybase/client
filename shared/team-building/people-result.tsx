import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Types from '../constants/types/team-building'
import * as Tracker2Constants from '../constants/tracker2'
import * as FsConstants from '../constants/fs'
import * as FsTypes from '../constants/types/fs'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as ProfileGen from '../actions/profile-gen'
import * as WalletsGen from '../actions/wallets-gen'
import * as WalletsType from '../constants/types/wallets'
import * as ChatConstants from '../constants/chat2'
import * as Container from '../util/container'
import * as Chat2Gen from '../actions/chat2-gen'

import capitalize from 'lodash/capitalize'
import {serviceIdToIconFont, serviceIdToAccentColor, serviceMapToArray} from './shared'

export type Props = {
  // They are already a member in the actual team, not this temporary set.
  isPreExistingTeamMember: boolean
  resultForService: Types.ServiceIdWithContact
  username: string
  prettyName: string
  displayLabel: string
  services: {[K in Types.ServiceIdWithContact]?: string}
  inTeam: boolean
  followingState: Types.FollowingState
  highlight: boolean
  onAdd: () => void
  onRemove: () => void
}

/*
 * Case 1: the service is 'keybase' (isKeybaseResult = true)
 *
 *    Top: "{keybaseUsername}" (with following state color)
 *    Bottom: "{prettyName} • {services icons}"
 *
 * Case 2: the service is not keybase
 *
 *    Top: "{serviceUsername}"
 *    Bottom: "{keybaseUsername} • {prettyName} • {services icons}"
 *
 *    {keybaseUsername} if the user is also a keybase user
 *    {prettyName} if the user added it. Can fallback to username if no prettyName is set
 *    {service icons} if the user has proofs
 */
const PeopleResult = (props: Props) => {
  const dispatch = Container.useDispatch()
  /*
   * Regardless of the service that is being searched, if we find that a
   * service user is also a keybase user, we also want to show their keybase
   * username, other services, and full name.
   */
  const isKeybaseResult = props.resultForService === 'keybase'
  const keybaseUsername: string | null = props.services['keybase'] || null
  const serviceUsername = props.services[props.resultForService]
  const onAdd = !props.isPreExistingTeamMember ? props.onAdd : undefined
  const onRemove = !props.isPreExistingTeamMember ? props.onRemove : undefined

  // action button specific definitions
  const myUsername = Container.useSelector(state => state.config.username)
  const userDetails = Container.useSelector(state => Tracker2Constants.getDetails(state, props.username))
  const blocked = userDetails.blocked
  const decoratedUsername = keybaseUsername ? keybaseUsername : `${serviceUsername}@${props.resultForService}`

  const onMenuAddToTeam = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {username: props.username}, selected: 'profileAddToTeam'}],
      })
    )
  const onOpenPrivateFolder = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(
      FsConstants.makeActionForOpenPathInFilesTab(
        FsTypes.stringToPath(`/keybase/private/${decoratedUsername},${myUsername}`)
      )
    )
  }, [dispatch, myUsername, decoratedUsername])
  const onBrowsePublicFolder = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(
      FsConstants.makeActionForOpenPathInFilesTab(
        FsTypes.stringToPath(`/keybase/public/${decoratedUsername}`)
      )
    )
  }

  const onSendLumens = () =>
    keybaseUsername &&
    dispatch(
      WalletsGen.createOpenSendRequestForm({
        from: WalletsType.noAccountID,
        isRequest: false,
        recipientType: 'keybaseUser',
        to: keybaseUsername,
      })
    )
  const onRequestLumens = () =>
    keybaseUsername &&
    dispatch(
      WalletsGen.createOpenSendRequestForm({
        from: WalletsType.noAccountID,
        isRequest: true,
        recipientType: 'keybaseUser',
        to: keybaseUsername,
      })
    )
  const onBlock = () =>
    keybaseUsername &&
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {username: keybaseUsername}, selected: 'profileBlockUser'}],
      })
    )
  const onUnblock = React.useCallback(
    () =>
      keybaseUsername &&
      dispatch(ProfileGen.createSubmitUnblockUser({guiID: userDetails.guiID, username: keybaseUsername})),
    [dispatch, keybaseUsername, userDetails.guiID]
  )
  const onChat = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(Chat2Gen.createPreviewConversation({participants: [decoratedUsername], reason: 'tracker'}))
  }

  const dropdown = keybaseUsername ? (
    <DropdownButton
      key="dropdown"
      onAddToTeam={onMenuAddToTeam}
      onOpenPrivateFolder={onOpenPrivateFolder}
      onBrowsePublicFolder={onBrowsePublicFolder}
      onSendLumens={onSendLumens}
      onRequestLumens={onRequestLumens}
      onBlock={onBlock}
      onUnblock={onUnblock}
      blocked={blocked}
    />
  ) : (
    <DropdownButton
      // if a result doesn't include a keybase account, the only action we can show is opening private folder
      key="dropdown"
      onOpenPrivateFolder={onOpenPrivateFolder}
    />
  )

  const chatButton = (
    <Kb.WaitingButton
      key="Chat"
      label="Chat"
      small={true}
      waitingKey={ChatConstants.waitingKeyCreating}
      onClick={e => {
        e.stopPropagation() // instead of using onAdd, use onChat logic
        onChat()
      }}
    >
      <Kb.Icon type="iconfont-chat" color={Styles.globalColors.white} style={styles.chatIcon} />
    </Kb.WaitingButton>
  )

  const buttons = Styles.isMobile ? [] : [chatButton, dropdown] // don't show action buttons on mobile for space reasons

  return (
    <Kb.ClickableBox onClick={props.inTeam ? onRemove : onAdd}>
      <Kb.Box2
        className="hover_background_color_blueLighter2 people-result-row"
        direction="horizontal"
        fullWidth={true}
        centerChildren={true}
        style={Styles.collapseStyles([styles.rowContainer, props.highlight ? styles.highlighted : null])}
      >
        <Avatar resultForService={props.resultForService} keybaseUsername={keybaseUsername} />
        <Kb.Box2 direction="vertical" style={styles.username}>
          {serviceUsername ? (
            <>
              <Username
                followingState={props.followingState}
                isKeybaseResult={isKeybaseResult}
                keybaseUsername={keybaseUsername}
                username={serviceUsername || ''}
              />
              <BottomRow
                displayLabel={props.displayLabel}
                followingState={props.followingState}
                isKeybaseResult={isKeybaseResult}
                isPreExistingTeamMember={props.isPreExistingTeamMember}
                keybaseUsername={keybaseUsername}
                prettyName={props.prettyName}
                services={props.services}
                username={serviceUsername || ''}
              />
            </>
          ) : (
            <>
              <Kb.Text type="BodySemibold" lineClamp={1}>
                {props.prettyName}
              </Kb.Text>
              {!!props.displayLabel && props.displayLabel !== props.prettyName && (
                <Kb.Text type="BodySmall" lineClamp={1}>
                  {props.displayLabel}
                </Kb.Text>
              )}
            </>
          )}
        </Kb.Box2>
        <Kb.Box2
          gap="tiny"
          centerChildren={true}
          direction="horizontal"
          className="result-actions"
          style={props.highlight ? styles.actionButtonsHighlighted : undefined}
        >
          {buttons}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const avatarSize = Styles.isMobile ? 48 : 32
const dotSeparator = '•'

const isPreExistingTeamMemberText = (prettyName: string, username: string) =>
  `${prettyName && prettyName !== username ? prettyName + ` ${dotSeparator} ` : ''}Already in team`

const textWithConditionalSeparator = (text: string, conditional: boolean) =>
  `${text}${conditional ? ` ${dotSeparator}` : ''}`

const Avatar = ({
  resultForService,
  keybaseUsername,
}: {
  keybaseUsername: string | null
  resultForService: Types.ServiceIdWithContact
}) => {
  if (keybaseUsername) {
    return <Kb.Avatar size={avatarSize} username={keybaseUsername} />
  } else if (resultForService === 'keybase' || Types.isContactServiceId(resultForService)) {
    return <Kb.Avatar size={avatarSize} username="invalid username for placeholder avatar" />
  }

  return (
    <Kb.Icon
      fontSize={avatarSize}
      type={serviceIdToIconFont(resultForService)}
      colorOverride={serviceIdToAccentColor(resultForService)}
    />
  )
}

// If service icons are the only item present in the bottom row, then don't apply margin-left to the first icon
const ServicesIcons = (props: {
  services: {[K in Types.ServiceIdWithContact]?: string}
  prettyName: string
  displayLabel: string
  isKeybaseResult: boolean
  keybaseUsername: string | null
}) => {
  const serviceIds = serviceMapToArray(props.services)
  // When the result is from a non-keybase service, we could have:
  //  1. keybase username
  //  2. pretty name or display label. prettyName can fallback to username if no prettyName is set.
  //
  // When the result is from the keybase service, we could have:
  //  1. prettyName that matches the username - in which case it will be hidden
  //  1. No prettyName and also no displayLabel
  const firstIconNoMargin = !props.isKeybaseResult
    ? !props.keybaseUsername && !props.prettyName && !props.displayLabel
    : props.prettyName
    ? props.prettyName === props.keybaseUsername
    : !props.displayLabel
  return (
    <Kb.Box2 direction="horizontal" fullWidth={Styles.isMobile} style={styles.services}>
      {serviceIds.map((serviceName, index) => {
        const iconStyle =
          firstIconNoMargin && index === 0 ? null : Kb.iconCastPlatformStyles(styles.serviceIcon)
        return (
          <Kb.WithTooltip
            key={serviceName}
            tooltip={`${props.services[serviceName]} on ${capitalize(serviceName)}`}
            position="top center"
          >
            {/* On desktop the styles need to be applied to the box parent if they are to work correctly */}
            <Kb.Icon
              fontSize={14}
              type={serviceIdToIconFont(serviceName)}
              style={Styles.isMobile && iconStyle}
              boxStyle={!Styles.isMobile && iconStyle}
            />
          </Kb.WithTooltip>
        )
      })}
    </Kb.Box2>
  )
}

const FormatPrettyName = (props: {
  displayLabel: string
  prettyName: string
  username: string
  services: Array<Types.ServiceIdWithContact>
  showServicesIcons: boolean
}) =>
  props.prettyName && props.prettyName !== props.username ? (
    <Kb.Text type="BodySmall" lineClamp={1}>
      {textWithConditionalSeparator(props.prettyName, props.showServicesIcons && !!props.services.length)}
    </Kb.Text>
  ) : props.displayLabel ? (
    <Kb.Text type="BodySmall" lineClamp={1}>
      {textWithConditionalSeparator(props.displayLabel, props.showServicesIcons && !!props.services.length)}
    </Kb.Text>
  ) : null

const BottomRow = (props: {
  isKeybaseResult: boolean
  username: string
  isPreExistingTeamMember: boolean
  keybaseUsername: string | null
  followingState: Types.FollowingState
  displayLabel: string
  prettyName: string
  services: {[K in Types.ServiceIdWithContact]?: string}
}) => {
  const serviceUserIsAlsoKeybaseUser = !props.isKeybaseResult && props.keybaseUsername
  const showServicesIcons = props.isKeybaseResult || !!props.keybaseUsername
  const keybaseUsernameComponent = serviceUserIsAlsoKeybaseUser ? (
    <>
      <Kb.Text
        type="BodySemibold"
        style={followingStateToStyle(props.keybaseUsername ? props.followingState : 'NoState')}
        lineClamp={1}
      >
        {props.keybaseUsername}
      </Kb.Text>
      <Kb.Text type="BodySmall">&nbsp;</Kb.Text>
      <Kb.Text type="BodySmall">{dotSeparator}</Kb.Text>
      <Kb.Text type="BodySmall">&nbsp;</Kb.Text>
    </>
  ) : null

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignSelf="flex-start" style={styles.bottomRowContainer}>
      <Kb.ScrollView
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={1000}
        contentContainerStyle={styles.bottomRowScrollContainer}
      >
        {keybaseUsernameComponent}
        {props.isPreExistingTeamMember ? (
          <Kb.Text type="BodySmall" lineClamp={1}>
            {isPreExistingTeamMemberText(props.prettyName, props.username)}
          </Kb.Text>
        ) : (
          <>
            <FormatPrettyName
              displayLabel={props.displayLabel}
              prettyName={props.prettyName}
              username={props.username}
              services={serviceMapToArray(props.services)}
              showServicesIcons={showServicesIcons}
            />
            {/* When the service result does not have any information other than
            the service username we don't want to show the service icons since
            there will only be one item */}
            {showServicesIcons ? (
              <ServicesIcons
                services={props.services}
                isKeybaseResult={props.isKeybaseResult}
                prettyName={props.prettyName}
                displayLabel={props.displayLabel}
                keybaseUsername={props.keybaseUsername}
              />
            ) : null}
          </>
        )}
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

const Username = (props: {
  followingState: Types.FollowingState
  isKeybaseResult: boolean
  keybaseUsername: string | null
  username: string
}) => (
  <Kb.Text
    type="BodySemibold"
    style={followingStateToStyle(
      props.isKeybaseResult && props.keybaseUsername ? props.followingState : 'NoState'
    )}
  >
    {props.username}
  </Kb.Text>
)

type DropdownProps = {
  onAddToTeam?: () => void
  onOpenPrivateFolder?: () => void
  onBrowsePublicFolder?: () => void
  onSendLumens?: () => void
  onRequestLumens?: () => void
  onBlock?: () => void
  onUnblock?: () => void
  blocked?: boolean
  onUnfollow?: () => void
}

const DropdownButton = Kb.OverlayParentHOC((p: Kb.PropsWithOverlay<DropdownProps>) => {
  const items = [
    p.onAddToTeam && {onClick: p.onAddToTeam, title: 'Add to team...'},
    p.onSendLumens && {onClick: p.onSendLumens, title: 'Send Lumens (XLM)'},
    p.onRequestLumens && {onClick: p.onRequestLumens, title: 'Request Lumens (XLM)'},
    p.onOpenPrivateFolder && {onClick: p.onOpenPrivateFolder, title: 'Open private folder'},
    p.onBrowsePublicFolder && {onClick: p.onBrowsePublicFolder, title: 'Browse public folder'},
    p.onUnblock &&
      p.onBlock &&
      (p.blocked
        ? {danger: true, onClick: p.onUnblock, title: 'Unblock'}
        : {danger: true, onClick: p.onBlock, title: 'Block'}),
  ].reduce<Kb.MenuItems>((arr, i) => {
    i && arr.push(i)
    return arr
  }, [])

  return (
    <Kb.ClickableBox
      onClick={e => {
        e.stopPropagation()
        p.toggleShowingMenu()
      }}
      ref={p.setAttachmentRef}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
        <Kb.Button onClick={undefined} mode="Secondary" style={styles.dropdownButton} small={true}>
          <Kb.Icon color={Styles.globalColors.blue} type="iconfont-ellipsis" />
        </Kb.Button>
      </Kb.Box2>
      <Kb.FloatingMenu
        closeOnSelect={true}
        attachTo={p.getAttachmentRef}
        items={items}
        onHidden={p.toggleShowingMenu}
        position="bottom right"
        visible={p.showingMenu}
      />
    </Kb.ClickableBox>
  )
})

export const userResultHeight = Styles.isMobile ? Styles.globalMargins.xlarge : 48
const styles = Styles.styleSheetCreate(() => ({
  actionButtonsHighlighted: Styles.platformStyles({
    isElectron: {
      visibility: 'visible',
    },
  }),
  bottomRowContainer: {
    alignItems: 'baseline',
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  bottomRowScrollContainer: {
    alignItems: 'baseline',
    display: 'flex',
  },
  chatIcon: {marginRight: Styles.globalMargins.tiny},
  contactName: {
    lineHeight: 22,
  },
  dropdownButton: {minWidth: undefined},
  highlighted: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.blueLighter2,
      borderRadius: Styles.borderRadius,
    },
  }),
  keybaseServiceIcon: {
    marginRight: Styles.globalMargins.xtiny,
  },
  rowContainer: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xsmall),
    height: userResultHeight,
  },
  serviceIcon: {
    marginLeft: Styles.globalMargins.xtiny,
    marginTop: 1,
  },
  services: {
    justifyContent: 'flex-start',
  },
  username: {
    flex: 1,
    marginLeft: Styles.globalMargins.small,
  },
}))

const followingStateToStyle = (followingState: Types.FollowingState) => {
  return {
    Following: {
      color: Styles.globalColors.greenDark,
    },
    NoState: {
      color: Styles.globalColors.black,
    },
    NotFollowing: {
      color: Styles.globalColors.blueDark,
    },
    You: {
      color: Styles.globalColors.black,
    },
  }[followingState]
}

export default PeopleResult
