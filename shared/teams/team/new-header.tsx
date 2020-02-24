import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as TeamBuildingGen from '../../actions/team-building-gen'
import {selfToUser} from '../../constants/team-building'
import TeamMenu from './menu-container'
import {TeamID} from '../../constants/types/teams'
import {pluralize} from '../../util/string'
import capitalize from 'lodash/capitalize'
import {Activity} from '../common'
import {appendNewTeamBuilder} from '../../actions/typed-routes'
import flags from '../../util/feature-flags'

const AddPeopleButton = ({teamID}: {teamID: TeamID}) => {
  const dispatch = Container.useDispatch()
  const onAdd = () => dispatch(appendNewTeamBuilder(teamID)) // TODO this should append step 1 of wizard 🧙‍♂️
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
  const activityLevel = 'active' // TODO plumbing
  const newMemberCount = 0 // TODO plumbing

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
    <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xtiny" style={styles.flexShrink}>
      <Kb.Box2
        direction={Styles.isMobile ? 'vertical' : 'horizontal'}
        gap="xtiny"
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
          <Kb.Text type="Header" lineClamp={3} style={styles.header}>
            {meta.teamname}
          </Kb.Text>
          {!!callbacks.onRename && <Kb.Icon type="iconfont-edit" onClick={callbacks.onRename} />}
        </Kb.Box2>
        {meta.isOpen && (
          <Kb.Meta title="open" backgroundColor={Styles.globalColors.green} style={styles.openMeta} />
        )}
      </Kb.Box2>
      {!!meta.role && (
        <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start">
          {(meta.role === 'admin' || meta.role === 'owner') && (
            <Kb.Icon
              color={meta.role === 'owner' ? Styles.globalColors.yellowDark : Styles.globalColors.black_35}
              fontSize={Styles.isMobile ? 16 : 10}
              type={meta.role === 'owner' ? 'iconfont-crown-owner' : 'iconfont-crown-admin'}
            />
          )}
          {(!Styles.isMobile || !!meta.role) && (
            <>
              <Kb.Text type="BodySmall">
                {Styles.isMobile
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

  const bottomDescriptorsAndButtons = (
    <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="tiny">
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
      <Activity level={activityLevel} />
      <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.rightActionsContainer}>
        {meta.isMember && <Kb.Button label="Chat" onClick={callbacks.onChat} small={true} />}
        {yourOperations.editTeamDescription && (
          <Kb.Button label="Edit" onClick={callbacks.onEdit} small={true} mode="Secondary" />
        )}
        <Kb.Button label="Share" onClick={callbacks.onShare} small={true} mode="Secondary" />
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
  )

  const addInviteAndLinkBox = (
    <Kb.Box2
      direction="vertical"
      gap={Styles.isMobile ? 'xtiny' : 'tiny'}
      style={styles.addInviteAndLinkBox}
      className="addInviteAndLinkBox"
      alignItems="center"
      alignSelf="flex-end"
    >
      <AddPeopleButton teamID={props.teamID} />
      {flags.teamInvites && (
        <Kb.Text type={Styles.isMobile ? 'BodyTiny' : 'BodySmall'}>
          {Styles.isMobile ? 'or' : 'or share a link:'}
        </Kb.Text>
      )}
      {flags.teamInvites &&
        (Styles.isMobile ? (
          <Kb.Button
            label="Generate invite link"
            onClick={callbacks.onManageInvites}
            style={Styles.globalStyles.flexGrow}
            mode="Secondary"
            fullWidth={true}
          />
        ) : (
          <Kb.Box2 direction="vertical" gap="xtiny" alignItems="flex-start">
            <Kb.CopyText text="https://keybase.io/team/link/blahblah/" />
            <Kb.Text type="BodyTiny">Adds as writer • Expires 10,000 ys</Kb.Text>
            <Kb.Text type="BodyTiny" onClick={callbacks.onManageInvites} className="hover-underline">
              Manage invite links
            </Kb.Text>
          </Kb.Box2>
        ))}
    </Kb.Box2>
  )

  if (Styles.isMobile) {
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

const nyi = () => console.warn('not yet implemented')
const useHeaderCallbacks = (teamID: TeamID) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const meta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const yourUsername = Container.useSelector(s => s.config.username)
  const yourOperations = Container.useSelector(s => Constants.getCanPerformByID(s, teamID))

  const onAddSelf = () => {
    dispatch(appendNewTeamBuilder(teamID))
    dispatch(
      TeamBuildingGen.createAddUsersToTeamSoFar({namespace: 'teams', users: [selfToUser(yourUsername)]})
    )
  }
  const onChat = () =>
    dispatch(Chat2Gen.createPreviewConversation({reason: 'teamHeader', teamname: meta.teamname}))
  const onEditAvatar = yourOperations.editTeamDescription
    ? () =>
        dispatch(
          nav.safeNavigateAppendPayload({
            path: [
              {props: {sendChatNotification: true, teamname: meta.teamname}, selected: 'teamEditTeamAvatar'},
            ],
          })
        )
    : undefined
  const onEditDescription = yourOperations.editTeamDescription
    ? () =>
        dispatch(
          nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'teamEditTeamDescription'}]})
        )
    : undefined
  const onRename = yourOperations.renameTeam
    ? () =>
        dispatch(
          nav.safeNavigateAppendPayload({path: [{props: {teamname: meta.teamname}, selected: 'teamRename'}]})
        )
    : undefined
  const onEdit = nyi
  const onManageInvites = nyi
  const onShare = nyi

  return {onAddSelf, onChat, onEdit, onEditAvatar, onEditDescription, onManageInvites, onRename, onShare}
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
          height: 165,
          marginBottom: Styles.globalMargins.xsmall,
          marginRight: Styles.globalMargins.small,
          marginTop: Styles.globalMargins.tiny,
          width: 220,
        },
        isMobile: {
          borderRadius: 8,
          flexGrow: 1,
          margin: Styles.globalMargins.tiny,
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
      marginBottomRightTiny: {
        marginBottom: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.tiny,
      },
      openMeta: Styles.platformStyles({
        isElectron: {
          alignSelf: 'center',
          marginLeft: Styles.globalMargins.xtiny,
        },
        isMobile: {alignSelf: 'flex-start'},
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
