import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Chat2Gen from '../../actions/chat2-gen'
import TeamMenu from './menu-container'
import {TeamID} from '../../constants/types/teams'
import {pluralize} from '../../util/string'
import capitalize from 'lodash/capitalize'
import {Activity, useActivityLevels, useTeamLinkPopup} from '../common'
import flags from '../../util/feature-flags'
import * as TeamsGen from '../../actions/teams-gen'
import * as Types from '../../constants/types/teams'
import {InviteItem} from './invites/invite-item'

const AddPeopleButton = ({teamID}: {teamID: TeamID}) => {
  const dispatch = Container.useDispatch()
  const onAdd = () => dispatch(TeamsGen.createStartAddMembersWizard({teamID}))
  return (
    <Kb.Button
      label="Add/Invite people"
      onClick={onAdd}
      type="Success"
      mode="Primary"
      fullWidth={true}
      style={styles.addPeopleButton}
    />
  )
}
type FeatureTeamCardProps = {teamID: Types.TeamID}
const FeatureTeamCard = ({teamID}: FeatureTeamCardProps) => {
  const dispatch = Container.useDispatch()
  const onFeature = () => dispatch(TeamsGen.createSetMemberPublicity({showcase: true, teamID}))
  const onNoThanks = React.useCallback(
    () => dispatch(TeamsGen.createSetJustFinishedAddMembersWizard({justFinished: false})),
    [dispatch]
  )
  // Automatically dismisses this when the user navigates away
  React.useEffect(() => onNoThanks, [onNoThanks])
  const waiting = Container.useAnyWaiting(Constants.setMemberPublicityWaitingKey(teamID))
  return (
    <Kb.Box2
      direction="vertical"
      gap={Styles.isPhone ? 'xtiny' : 'tiny'}
      style={styles.addInviteAsFeatureTeamBox}
      className="addInviteAndLinkBox"
      alignItems="flex-start"
      alignSelf="flex-end"
      fullWidth={true}
    >
      <Kb.Box style={styles.illustration}>
        <Kb.Icon type="icon-illustration-teams-feature-profile-460-64" />
      </Kb.Box>
      <Kb.Text type="BodySemibold">Feature team on your profile?</Kb.Text>
      <Kb.Text type="BodySmall">So your friends or coworkers know of your team's existence.</Kb.Text>
      <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
        <Kb.Button
          label="Yes, feature it"
          type="Success"
          onClick={onFeature}
          small={true}
          style={Styles.globalStyles.flexOne}
          waiting={waiting}
        />
        <Kb.Button
          label="Later"
          type="Dim"
          onClick={onNoThanks}
          small={true}
          style={Styles.globalStyles.flexOne}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

type HeaderTitleProps = Kb.PropsWithOverlay<{
  teamID: TeamID
}>

const roleDisplay = {
  admin: 'an admin of',
  none: 'not a member of',
  owner: 'an owner of',
  reader: 'a reader in',
  writer: 'a writer in',
}

const _HeaderTitle = (props: HeaderTitleProps) => {
  const {teamID} = props
  const meta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const details = Container.useSelector(s => Constants.getTeamDetails(s, teamID))
  const yourOperations = Container.useSelector(s => Constants.getCanPerformByID(s, teamID))
  const justFinishedAddWizard = Container.useSelector(s => s.teams.addMembersWizard.justFinished)
  useActivityLevels()
  const activityLevel = Container.useSelector(s => s.teams.activityLevels.teams.get(teamID) || 'none')
  const newMemberCount = 0 // TODO plumbing

  const mostRecentInviteLink = Constants.maybeGetMostRecentValidInviteLink(details.inviteLinks)
  const validInviteLinkCount = Constants.countValidInviteLinks(details.inviteLinks)

  const callbacks = useHeaderCallbacks(teamID)

  const avatar = (
    <Kb.Avatar
      editable={!!callbacks.onEditAvatar}
      onEditAvatarClick={callbacks.onEditAvatar}
      teamname={meta.teamname}
      size={96}
      style={Styles.collapseStyles([
        styles.alignSelfFlexStart,
        callbacks.onEditAvatar && styles.marginBottomRightTiny, // space for edit icon
        callbacks.onEditAvatar && styles.clickable,
      ])}
    />
  )

  const topDescriptors = (
    <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xxtiny" style={styles.flexShrink}>
      <Kb.Box2
        direction={Styles.isPhone ? 'vertical' : 'horizontal'}
        gap="xxtiny"
        alignSelf="flex-start"
        style={styles.flexShrink}
      >
        <Kb.Box2
          direction="horizontal"
          alignItems="flex-end"
          gap="xtiny"
          alignSelf="flex-start"
          style={styles.flexShrink}
        >
          <Kb.Text type="Header" lineClamp={3} style={styles.header} selectable={true}>
            {meta.teamname}
          </Kb.Text>
          {!!callbacks.onRename && <Kb.Icon type="iconfont-edit" onClick={callbacks.onRename} />}
        </Kb.Box2>
        {meta.isOpen && (
          <Kb.Meta title="open" backgroundColor={Styles.globalColors.green} style={styles.openMeta} />
        )}
      </Kb.Box2>
      {!!meta.role && (
        <Kb.Box2 direction="horizontal" gap="xxtiny" alignSelf="flex-start">
          {(meta.role === 'admin' || meta.role === 'owner') && (
            <Kb.Icon
              color={meta.role === 'owner' ? Styles.globalColors.yellowDark : Styles.globalColors.black_35}
              fontSize={Styles.isPhone ? 16 : 10}
              type={meta.role === 'owner' ? 'iconfont-crown-owner' : 'iconfont-crown-admin'}
            />
          )}
          {(!Styles.isPhone || !!meta.role) && (
            <>
              <Kb.Text type="BodySmall">
                {Styles.isPhone
                  ? capitalize(meta.role)
                  : `You are ${roleDisplay[meta.role] || 'a member of'} this team. `}
              </Kb.Text>
              {meta.role === 'none' && (
                <Kb.Text
                  type="BodySmallSecondaryLink"
                  onClick={callbacks.onAddSelf}
                  style={styles.addSelfLink}
                >
                  Add yourself
                </Kb.Text>
              )}
            </>
          )}
        </Kb.Box2>
      )}
    </Kb.Box2>
  )

  const {popupAnchor, setShowingPopup, popup} = useTeamLinkPopup(meta.teamname)

  const bottomDescriptorsAndButtons = (
    <>
      <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xxtiny" gapStart={!Styles.isPhone}>
        {!!details.description && (
          <Kb.Text
            type="Body"
            lineClamp={3}
            onClick={callbacks.onEditDescription}
            className={Styles.classNames({'hover-underline': !!callbacks.onEditDescription})}
            style={styles.clickable}
          >
            {details.description}
          </Kb.Text>
        )}
        {meta.memberCount !== -1 && (
          <Kb.Text type="BodySmall">
            {meta.memberCount.toLocaleString()} {pluralize('member', meta.memberCount)}
            {!!newMemberCount && ` · ${newMemberCount} new this week`}
          </Kb.Text>
        )}
        <Activity level={activityLevel} style={styles.activity} />
        <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.rightActionsContainer}>
          {meta.isMember && <Kb.Button label="Chat" onClick={callbacks.onChat} small={true} />}
          {yourOperations.editTeamDescription && (
            <Kb.Button label="Edit" onClick={callbacks.onEditDescription} small={true} mode="Secondary" />
          )}
          <Kb.Button
            label="Share"
            onClick={() => setShowingPopup(true)}
            small={true}
            mode="Secondary"
            ref={popupAnchor}
          />
          <Kb.Button
            mode="Secondary"
            small={true}
            ref={props.setAttachmentRef}
            onClick={props.toggleShowingMenu}
          >
            <Kb.Icon type="iconfont-ellipsis" color={Styles.globalColors.blue} />
          </Kb.Button>
          <TeamMenu
            attachTo={props.getAttachmentRef}
            onHidden={props.toggleShowingMenu}
            teamID={props.teamID}
            visible={props.showingMenu}
          />
        </Kb.Box2>
      </Kb.Box2>
      {popup}
    </>
  )

  const additionalValidIndicator = validInviteLinkCount > 1 ? `(${validInviteLinkCount} active)` : ''
  const addInviteAndLinkBox =
    justFinishedAddWizard && !meta.showcasing ? (
      <FeatureTeamCard teamID={props.teamID} />
    ) : (
      <Kb.Box2
        direction="vertical"
        gap={Styles.isPhone ? 'xtiny' : 'tiny'}
        style={styles.addInviteAndLinkBox}
        className="addInviteAndLinkBox"
        alignItems="center"
        alignSelf="flex-end"
      >
        <AddPeopleButton teamID={props.teamID} />
        {flags.teamInvites && (
          <Kb.Text type={mostRecentInviteLink ? 'BodyTiny' : 'BodySmall'}>
            {mostRecentInviteLink ? 'or share a link:' : 'or'}
          </Kb.Text>
        )}
        {flags.teamInvites &&
          (mostRecentInviteLink ? (
            <Kb.Box2 direction="vertical" gap="xtiny" alignItems="flex-start">
              <InviteItem
                inviteLink={mostRecentInviteLink}
                teamID={props.teamID}
                style={styles.inviteLinkContainer}
                showDetails={false}
                showExpireAction={false}
              />
              <Kb.Text type="BodyTiny" onClick={callbacks.onManageInvites} className="hover-underline">
                Manage invite links {additionalValidIndicator}
              </Kb.Text>
            </Kb.Box2>
          ) : (
            <Kb.Button
              label="Generate invite link"
              onClick={callbacks.onGenerateLink}
              mode="Secondary"
              fullWidth={true}
            />
          ))}
      </Kb.Box2>
    )

  if (Styles.isPhone) {
    return (
      <Kb.Box2 alignItems="flex-start" direction="vertical" fullWidth={true} style={styles.backButton}>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={styles.outerBoxMobile}>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
            {avatar}
            {topDescriptors}
          </Kb.Box2>
          {bottomDescriptorsAndButtons}
          {yourOperations.manageMembers && (
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              {addInviteAndLinkBox}
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2
      alignItems="center"
      direction="horizontal"
      gap="small"
      gapStart={true}
      fullWidth={true}
      className="headerTitle"
      style={styles.backgroundWhite}
    >
      {avatar}
      <Kb.Box2
        direction="vertical"
        alignItems="flex-start"
        alignSelf="flex-start"
        style={styles.flexShrinkGrow}
      >
        {topDescriptors}
        {bottomDescriptorsAndButtons}
      </Kb.Box2>
      {yourOperations.manageMembers && addInviteAndLinkBox}
    </Kb.Box2>
  )
}
export default Kb.OverlayParentHOC(_HeaderTitle)

const useHeaderCallbacks = (teamID: TeamID) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const meta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const yourUsername = Container.useSelector(s => s.config.username)
  const yourOperations = Container.useSelector(s => Constants.getCanPerformByID(s, teamID))

  const onAddSelf = () => {
    dispatch(TeamsGen.createStartAddMembersWizard({teamID}))
    dispatch(
      TeamsGen.createAddMembersWizardPushMembers({members: [{assertion: yourUsername, role: 'writer'}]})
    )
  }
  const onChat = () =>
    dispatch(Chat2Gen.createPreviewConversation({reason: 'teamHeader', teamname: meta.teamname}))
  const onEditAvatar = yourOperations.editTeamDescription
    ? () =>
        dispatch(
          nav.safeNavigateAppendPayload({
            path: [{props: {sendChatNotification: true, teamID}, selected: 'profileEditAvatar'}],
          })
        )
    : undefined
  const onEditDescription = yourOperations.editTeamDescription
    ? () => dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'teamEditTeamInfo'}]}))
    : undefined
  const onRename = yourOperations.renameTeam
    ? () =>
        dispatch(
          nav.safeNavigateAppendPayload({path: [{props: {teamname: meta.teamname}, selected: 'teamRename'}]})
        )
    : undefined
  const onManageInvites = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'teamInviteHistory'}]}))
  const onGenerateLink = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'teamInviteLinksGenerate'}]}))

  return {
    onAddSelf,
    onChat,
    onEditAvatar,
    onEditDescription,
    onGenerateLink,
    onManageInvites,
    onRename,
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      activity: {alignSelf: 'flex-start'},
      addInviteAndLinkBox: Styles.platformStyles({
        common: {
          borderColor: Styles.globalColors.black_10,
          borderStyle: 'solid',
          borderWidth: 1,
          flexShrink: 0,
          padding: Styles.globalMargins.tiny,
        },
        isElectron: {
          borderRadius: 4,
          marginBottom: Styles.globalMargins.xsmall,
          marginRight: Styles.globalMargins.small,
          marginTop: Styles.globalMargins.tiny,
          width: 220,
        },
        isPhone: {
          borderRadius: 8,
          flexGrow: 1,
        },
        isTablet: {
          borderRadius: 4,
          marginBottom: Styles.globalMargins.xsmall,
          marginRight: Styles.globalMargins.small,
          marginTop: Styles.globalMargins.tiny,
          width: 260,
        },
      }),
      addInviteAsFeatureTeamBox: Styles.platformStyles({
        common: {
          borderColor: Styles.globalColors.black_10,
          borderStyle: 'solid',
          borderWidth: 1,
          flexShrink: 0,
          padding: Styles.globalMargins.tiny,
        },
        isElectron: {
          borderRadius: 4,
          height: 184,
          marginBottom: Styles.globalMargins.xsmall,
          marginRight: Styles.globalMargins.small,
          width: 220,
        },
        isPhone: {
          borderRadius: 8,
          flexGrow: 1,
          width: '100%',
        },
        isTablet: {
          borderRadius: 4,
          height: 194,
          marginBottom: Styles.globalMargins.xsmall,
          marginRight: Styles.globalMargins.small,
          width: 260,
        },
      }),
      addPeopleButton: {
        flexGrow: 0,
      },
      addSelfLink: {
        marginLeft: Styles.globalMargins.xtiny,
        textDecorationLine: 'underline',
      },
      alignSelfFlexStart: {
        alignSelf: 'flex-start',
      },
      backButton: {
        backgroundColor: Styles.globalColors.white,
      },
      backgroundWhite: {
        backgroundColor: Styles.globalColors.white,
      },
      banner: {
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xsmall, 0),
      },
      clickable: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.windowDraggingClickable,
        },
      }),
      flexShrink: {
        flexShrink: 1,
      },
      flexShrinkGrow: {
        flexGrow: 1,
        flexShrink: 1,
      },
      greenText: {
        color: Styles.globalColors.greenDark,
      },
      header: {
        flexShrink: 1,
      },
      illustration: {borderRadius: 4, overflow: 'hidden', width: '100%'},
      inviteLinkContainer: Styles.platformStyles({
        common: {
          borderColor: 'transparent',
          borderRadius: 0,
          borderStyle: undefined,
          borderWidth: 0,
          padding: 0,
        },
      }),
      marginBottomRightTiny: {
        marginBottom: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.tiny,
      },
      openMeta: Styles.platformStyles({
        isElectron: {
          alignSelf: 'center',
          marginLeft: Styles.globalMargins.xtiny,
        },
        isPhone: {alignSelf: 'flex-start'},
        isTablet: {
          alignSelf: 'center',
          marginLeft: Styles.globalMargins.xtiny,
        },
      }),
      outerBoxMobile: {
        ...Styles.padding(Styles.globalMargins.small),
        backgroundColor: Styles.globalColors.white,
      },
      rightActionsContainer: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          paddingTop: Styles.globalMargins.tiny,
        },
        isElectron: Styles.desktopStyles.windowDraggingClickable,
      }),
    } as const)
)
