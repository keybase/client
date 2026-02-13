import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import TeamMenu from './menu-container'
import {pluralize} from '@/util/string'
import {Activity, useActivityLevels, useTeamLinkPopup} from '../common'
import type * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'
import {useCurrentUserState} from '@/stores/current-user'
import {useTeamsState} from '@/stores/teams'

const AddPeopleButton = ({teamID}: {teamID: T.Teams.TeamID}) => {
  const startAddMembersWizard = useTeamsState(s => s.dispatch.startAddMembersWizard)
  const onAdd = () => startAddMembersWizard(teamID)
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
type FeatureTeamCardProps = {teamID: T.Teams.TeamID}
const FeatureTeamCard = ({teamID}: FeatureTeamCardProps) => {
  const {setJustFinishedAddMembersWizard, setMemberPublicity} = Teams.useTeamsState(
    C.useShallow(s => ({
      setJustFinishedAddMembersWizard: s.dispatch.setJustFinishedAddMembersWizard,
      setMemberPublicity: s.dispatch.setMemberPublicity,
    }))
  )
  const onFeature = () => setMemberPublicity(teamID, true)
  const onNoThanks = React.useCallback(() => {
    setJustFinishedAddMembersWizard(false)
  }, [setJustFinishedAddMembersWizard])
  // Automatically dismisses this when the user navigates away
  React.useEffect(() => onNoThanks, [onNoThanks])
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsSetMemberPublicity(teamID))
  return (
    <Kb.Box2
      direction="vertical"
      gap={Kb.Styles.isPhone ? 'xtiny' : 'tiny'}
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
      <Kb.Text type="BodySmall">{"So your friends or coworkers know of your team's existence."}</Kb.Text>
      <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
        <Kb.Button
          label="Yes, feature it"
          type="Success"
          onClick={onFeature}
          small={true}
          style={Kb.Styles.globalStyles.flexOne}
          waiting={waiting}
        />
        <Kb.Button
          label="Later"
          type="Dim"
          onClick={onNoThanks}
          small={true}
          style={Kb.Styles.globalStyles.flexOne}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

type HeaderTitleProps = {
  teamID: T.Teams.TeamID
}

const roleDisplay = {
  admin: 'an admin of',
  bot: 'a bot in',
  none: 'not a member of',
  owner: 'an owner of',
  reader: 'a reader in',
  restrictedbot: 'a bot in',
  writer: 'a writer in',
}

const HeaderTitle = (props: HeaderTitleProps) => {
  const {teamID} = props
  const teamsState = Teams.useTeamsState(
    C.useShallow(s => ({
      activityLevel: s.activityLevels.teams.get(teamID) || 'none',
      details: s.teamDetails.get(teamID),
      justFinishedAddWizard: s.addMembersWizard.justFinished,
      meta: Teams.getTeamMeta(s, teamID),
      yourOperations: Teams.getCanPerformByID(s, teamID),
    }))
  )
  const {activityLevel, details, justFinishedAddWizard} = teamsState
  const {meta, yourOperations} = teamsState
  useActivityLevels()

  const {onEditAvatar, onRename, onAddSelf, onChat, onEditDescription} = useHeaderCallbacks(teamID)
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return <TeamMenu attachTo={attachTo} onHidden={hidePopup} teamID={teamID} visible={true} />
    },
    [teamID]
  )
  const {showPopup: tmshowPopup, popupAnchor: tmpopupAnchor, popup: tmpopup} = Kb.usePopup2(makePopup)

  const avatar = (
    <Kb.Avatar
      editable={!!onEditAvatar}
      onEditAvatarClick={onEditAvatar}
      teamname={meta.teamname}
      size={96}
      style={Kb.Styles.collapseStyles([
        styles.alignSelfFlexStart,
        onEditAvatar && styles.marginBottomRightTiny, // space for edit icon
        onEditAvatar && styles.clickable,
      ])}
    />
  )

  const topDescriptors = (
    <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xxtiny" style={styles.flexShrink}>
      <Kb.Box2
        direction={Kb.Styles.isPhone ? 'vertical' : 'horizontal'}
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
          {!!onRename && <Kb.Icon type="iconfont-edit" onClick={onRename} />}
        </Kb.Box2>
        {meta.isOpen && (
          <Kb.Meta title="open" backgroundColor={Kb.Styles.globalColors.green} style={styles.openMeta} />
        )}
      </Kb.Box2>
      {
        <Kb.Box2 direction="horizontal" gap="xxtiny" alignSelf="flex-start">
          {(meta.role === 'admin' || meta.role === 'owner') && (
            <Kb.Icon
              color={
                meta.role === 'owner' ? Kb.Styles.globalColors.yellowDark : Kb.Styles.globalColors.black_35
              }
              fontSize={Kb.Styles.isPhone ? 16 : 10}
              type={meta.role === 'owner' ? 'iconfont-crown-owner' : 'iconfont-crown-admin'}
            />
          )}
          {!Kb.Styles.isPhone && (
            <>
              <Kb.Text type="BodySmall">
                {`You are ${roleDisplay[meta.role] || 'a member of'} this team. `}
              </Kb.Text>
              {meta.role === 'none' && (
                <Kb.Text type="BodySmallSecondaryLink" onClick={onAddSelf} style={styles.addSelfLink}>
                  Add yourself
                </Kb.Text>
              )}
            </>
          )}
        </Kb.Box2>
      }
    </Kb.Box2>
  )

  const {popupAnchor, showPopup, popup} = useTeamLinkPopup(meta.teamname)

  const bottomDescriptorsAndButtons = (
    <>
      <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xxtiny" gapStart={!Kb.Styles.isPhone}>
        {!!details?.description && (
          <Kb.Text
            type="Body"
            lineClamp={3}
            onClick={onEditDescription}
            className={Kb.Styles.classNames({'hover-underline': !!onEditDescription})}
            style={styles.clickable}
          >
            {details.description}
          </Kb.Text>
        )}
        {meta.memberCount !== -1 && (
          <Kb.Text type="BodySmall">
            {meta.memberCount.toLocaleString()} {pluralize('member', meta.memberCount)}
          </Kb.Text>
        )}
        <Activity level={activityLevel} style={styles.activity} />
        <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.rightActionsContainer}>
          {meta.isMember && <Kb.Button label="Chat" onClick={onChat} small={true} />}
          {yourOperations.editTeamDescription && (
            <Kb.Button label="Edit" onClick={onEditDescription} small={true} mode="Secondary" />
          )}
          <Kb.Button label="Share" onClick={showPopup} small={true} mode="Secondary" ref={popupAnchor} />
          <Kb.Button mode="Secondary" small={true} ref={tmpopupAnchor} onClick={tmshowPopup}>
            <Kb.Icon type="iconfont-ellipsis" color={Kb.Styles.globalColors.blue} />
          </Kb.Button>
          {tmpopup}
        </Kb.Box2>
      </Kb.Box2>
      {popup}
    </>
  )

  const addInviteAndLinkBox =
    justFinishedAddWizard && !meta.showcasing ? (
      <FeatureTeamCard teamID={props.teamID} />
    ) : (
      <Kb.Box2
        direction="vertical"
        gap={Kb.Styles.isPhone ? 'xtiny' : 'tiny'}
        style={styles.addInviteAndLinkBox}
        className="addInviteAndLinkBox"
        alignItems="center"
        alignSelf="flex-end"
      >
        <AddPeopleButton teamID={props.teamID} />
      </Kb.Box2>
    )

  if (Kb.Styles.isPhone) {
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
export default HeaderTitle

const useHeaderCallbacks = (teamID: T.Teams.TeamID) => {
  const nav = useSafeNavigation()
  const {addMembersWizardPushMembers, meta, startAddMembersWizard, yourOperations} = Teams.useTeamsState(
    C.useShallow(s => ({
      addMembersWizardPushMembers: s.dispatch.addMembersWizardPushMembers,
      meta: Teams.getTeamMeta(s, teamID),
      startAddMembersWizard: s.dispatch.startAddMembersWizard,
      yourOperations: Teams.getCanPerformByID(s, teamID),
    }))
  )
  const yourUsername = useCurrentUserState(s => s.username)

  const onAddSelf = () => {
    startAddMembersWizard(teamID)
    addMembersWizardPushMembers([{assertion: yourUsername, role: 'writer'}])
  }
  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
  const onChat = () => previewConversation({reason: 'teamHeader', teamname: meta.teamname})
  const onEditAvatar = yourOperations.editTeamDescription
    ? () =>
        nav.safeNavigateAppend({props: {sendChatNotification: true, teamID}, selected: 'profileEditAvatar'})
    : undefined
  const onEditDescription = yourOperations.editTeamDescription
    ? () => nav.safeNavigateAppend({props: {teamID}, selected: 'teamEditTeamInfo'})
    : undefined
  const onRename = yourOperations.renameTeam
    ? () => nav.safeNavigateAppend({props: {teamname: meta.teamname}, selected: 'teamRename'})
    : undefined
  return {
    onAddSelf,
    onChat,
    onEditAvatar,
    onEditDescription,
    onRename,
  }
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      activity: {alignSelf: 'flex-start'},
      addInviteAndLinkBox: Kb.Styles.platformStyles({
        common: {
          borderColor: Kb.Styles.globalColors.black_10,
          borderStyle: 'solid',
          borderWidth: 1,
          flexShrink: 0,
          padding: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {
          borderRadius: 4,
          marginBottom: Kb.Styles.globalMargins.xsmall,
          marginRight: Kb.Styles.globalMargins.small,
          marginTop: Kb.Styles.globalMargins.tiny,
          width: 220,
        },
        isPhone: {
          borderRadius: 8,
          flexGrow: 1,
        },
        isTablet: {
          borderRadius: 4,
          marginBottom: Kb.Styles.globalMargins.xsmall,
          marginRight: Kb.Styles.globalMargins.small,
          marginTop: Kb.Styles.globalMargins.tiny,
          width: 260,
        },
      }),
      addInviteAsFeatureTeamBox: Kb.Styles.platformStyles({
        common: {
          borderColor: Kb.Styles.globalColors.black_10,
          borderStyle: 'solid',
          borderWidth: 1,
          flexShrink: 0,
          padding: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {
          borderRadius: 4,
          height: 184,
          marginBottom: Kb.Styles.globalMargins.xsmall,
          marginRight: Kb.Styles.globalMargins.small,
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
          marginBottom: Kb.Styles.globalMargins.xsmall,
          marginRight: Kb.Styles.globalMargins.small,
          width: 260,
        },
      }),
      addPeopleButton: {flexGrow: 0},
      addSelfLink: {
        marginLeft: Kb.Styles.globalMargins.xtiny,
        textDecorationLine: 'underline',
      },
      alignSelfFlexStart: {alignSelf: 'flex-start'},
      backButton: {backgroundColor: Kb.Styles.globalColors.white},
      backgroundWhite: {backgroundColor: Kb.Styles.globalColors.white},
      clickable: Kb.Styles.platformStyles({
        isElectron: {...Kb.Styles.desktopStyles.windowDraggingClickable},
      }),
      flexShrink: {flexShrink: 1},
      flexShrinkGrow: {
        flexGrow: 1,
        flexShrink: 1,
      },
      header: {flexShrink: 1},
      illustration: {borderRadius: 4, overflow: 'hidden', width: '100%'},
      marginBottomRightTiny: {
        marginBottom: Kb.Styles.globalMargins.tiny,
        marginRight: Kb.Styles.globalMargins.tiny,
      },
      openMeta: Kb.Styles.platformStyles({
        isElectron: {
          alignSelf: 'center',
          marginLeft: Kb.Styles.globalMargins.xtiny,
        },
        isPhone: {alignSelf: 'flex-start'},
        isTablet: {
          alignSelf: 'center',
          marginLeft: Kb.Styles.globalMargins.xtiny,
        },
      }),
      outerBoxMobile: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
        backgroundColor: Kb.Styles.globalColors.white,
      },
      rightActionsContainer: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
        isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
      }),
    }) as const
)
