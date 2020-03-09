import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ProfileGen from '../../../actions/profile-gen'
import logger from '../../../logger'
import {pluralize} from '../../../util/string'
import {FloatingRolePicker} from '../../role-picker'
import * as TeamsGen from '../../../actions/teams-gen'
import {TeamDetailsSubscriber} from '../../subscriber'

type Props = {
  teamID: Types.TeamID
  username: string
}
type OwnProps = Container.RouteProps<Props>

const TeamMember = (props: OwnProps) => {
  const username = Container.getRouteProps(props, 'username', '')
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  const {subteamsIn, subteamsNotIn} = Container.useSelector(state =>
    Constants.getSubteamsInNotIn(state, teamID, username)
  )
  const [expandedSet, setExpandedSet] = React.useState(new Set<string>())
  const sections = [
    {
      data: subteamsIn,
      key: 'section-subteams',
      renderItem: ({item, index}: {item: Types.TeamMeta; index: number}) => (
        <SubteamInRow
          teamID={teamID}
          subteam={item}
          idx={index}
          username={username}
          expanded={expandedSet.has(item.teamname)}
          setExpanded={newExpanded => {
            if (newExpanded) {
              expandedSet.add(item.teamname)
            } else {
              expandedSet.delete(item.teamname)
            }
            setExpandedSet(new Set([...expandedSet]))
          }}
        />
      ),
      title: `${username} is in:`,
    },
    {
      data: subteamsNotIn,
      key: 'section-add-subteams',
      renderItem: ({item, index}: {item: Types.TeamMeta; index: number}) => (
        <SubteamNotInRow teamID={teamID} subteam={item} idx={index} username={username} />
      ),
      title: `Add ${username} to:`,
    },
  ]
  return (
    <Kb.SectionList
      stickySectionHeadersEnabled={true}
      renderSectionHeader={({section}) => <Kb.SectionDivider label={section.title} />}
      sections={sections}
      keyExtractor={item => item.key ?? `member:${username}:${item.teamname}`}
    />
  )
}

TeamMember.navigationOptions = (ownProps: OwnProps) => ({
  header: Container.isMobile
    ? () => (
        <TeamMemberHeader
          teamID={Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)}
          username={Container.getRouteProps(ownProps, 'username', '')}
        />
      )
    : undefined,
  headerExpandable: true,
  headerTitle: () => (
    <TeamMemberHeader
      teamID={Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)}
      username={Container.getRouteProps(ownProps, 'username', '')}
    />
  ),
})

type SubteamNotInRowProps = {
  teamID: Types.TeamID
  username: string
  subteam: Types.TeamMeta
  idx: number
}
type SubteamInRowProps = SubteamNotInRowProps & {
  expanded: boolean
  setExpanded: (b: boolean) => void
}
const SubteamNotInRow = (props: SubteamNotInRowProps) => {
  const dispatch = Container.useDispatch()
  const onAdd = (role: Types.TeamRoleType) =>
    dispatch(
      TeamsGen.createAddToTeam({
        sendChatNotification: true,
        teamID: props.subteam.id,
        users: [{assertion: props.username, role}],
      })
    )

  const disabledRoles = Container.useSelector(state =>
    Constants.getDisabledReasonsForRolePicker(state, props.subteam.id, props.username)
  )

  const [role, setRole] = React.useState<Types.TeamRoleType>('writer')
  const [open, setOpen] = React.useState(false)
  const action = (
    <FloatingRolePicker
      onConfirm={() => {
        onAdd(role)
        setOpen(false)
      }}
      onSelectRole={setRole}
      open={open}
      onCancel={() => setOpen(false)}
      selectedRole={role}
      disabledRoles={disabledRoles}
    >
      <Kb.Button label="Add" onClick={() => setOpen(!open)} />
    </FloatingRolePicker>
  )

  const memberCount = props.subteam.memberCount ?? -1
  const body = (
    <Kb.Box2 direction="vertical" alignItems="flex-start">
      <Kb.Text type="BodySemibold">{props.subteam.teamname}</Kb.Text>
      <Kb.Text type="BodySmall">
        {memberCount.toLocaleString()} {pluralize('member', memberCount)}
      </Kb.Text>
      <TeamDetailsSubscriber teamID={props.subteam.id} />
    </Kb.Box2>
  )
  const icon = <Kb.Avatar teamname={props.subteam.teamname} size={32} />
  return <Kb.ListItem2 icon={icon} body={body} action={action} firstItem={props.idx === 0} type="Large" />
}
const SubteamInRow = (props: SubteamInRowProps) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onAddToChannels = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [
          {
            props: {teamID: props.subteam.id, username: props.username},
            selected: 'teamsAddMemberToChannels',
          },
        ],
      })
    )
  const onKickOut = () =>
    dispatch(TeamsGen.createRemoveMember({teamID: props.subteam.id, username: props.username}))

  const {expanded, setExpanded} = props

  const icon = (
    <Kb.Icon
      type={expanded ? 'iconfont-arrow-down' : 'iconfont-arrow-right'}
      onClick={() => setExpanded(!expanded)}
    />
  )

  // TODO(Y2K-1291): get this data
  const channels = ['general', 'aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff', 'mmm']
  const channelsJoined = channels.join(', #')
  const body = (
    <Kb.Box2 direction="vertical" fullWidth={true} alignItems="flex-start" gap="tiny" style={styles.listItem}>
      <Kb.Box2 direction="horizontal" alignSelf="flex-start" gap="tiny">
        <Kb.Avatar teamname={props.subteam.teamname} size={32} />
        <Kb.Box2 direction="vertical" alignItems="flex-start">
          <Kb.Text type="BodySemibold">{props.subteam.teamname}</Kb.Text>
          <Kb.Text type="BodySmall">Joined Feb 1944 {/* TODO: where to get this data? */}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      {expanded && (
        <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start">
          <Kb.Icon type="iconfont-clock" color={Styles.globalColors.black_20} />
          <Kb.Text type="BodySmall">Active 1 min ago</Kb.Text>
          {/* TODO: where to get this data? */}
        </Kb.Box2>
      )}
      {expanded && (
        <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start">
          <Kb.Icon type="iconfont-clock" color={Styles.globalColors.black_20} />
          <Kb.Text type="BodySmall">Member of #{channelsJoined}</Kb.Text>
        </Kb.Box2>
      )}
      {expanded && (
        <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start">
          <Kb.Button mode="Secondary" onClick={onAddToChannels} label="Add to Channels" />
          {/* TODO: icon on this button */}
          <Kb.Button mode="Secondary" type="Danger" onClick={onKickOut} label="Kick out" />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
  const height = expanded ? (Styles.isMobile ? 208 : 140) : undefined
  return (
    <Kb.ListItem2 statusIcon={icon} body={body} firstItem={props.idx === 0} type="Large" height={height} />
  )
}

// exported for stories
export const TeamMemberHeader = (props: Props) => {
  const {teamID, username} = props
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const teamMeta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const teamDetails = Container.useSelector(s => Constants.getTeamDetails(s, teamID))
  const yourUsername = Container.useSelector(s => s.config.username)

  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onChat = () =>
    dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'memberView'}))
  const onViewProfile = () => dispatch(ProfileGen.createShowUserProfile({username}))
  const onViewTeam = () =>
    dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'team'}]}))

  const member = teamDetails.members.get(username)
  if (!member) {
    // loading? should never happen.
    logger.error('[team member view] no data! this should never happen.')
    return null
  }

  const buttons = (
    <Kb.Box2 direction="horizontal" gap="tiny" alignSelf={Styles.isMobile ? 'flex-start' : 'flex-end'}>
      <Kb.Button small={true} label="Chat" onClick={onChat} />
      <Kb.Button small={true} label="View profile" onClick={onViewProfile} mode="Secondary" />
      {username !== yourUsername && <BlockDropdown username={username} />}
    </Kb.Box2>
  )

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.headerContainer}>
      {Styles.isMobile && (
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start">
          <Kb.BackButton onClick={onBack} />
        </Kb.Box2>
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContent}>
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
          <Kb.Box2
            direction="horizontal"
            alignItems="center"
            gap={Styles.isMobile ? 'tiny' : 'xtiny'}
            alignSelf="flex-start"
          >
            <Kb.Avatar size={16} teamname={teamMeta.teamname} />
            <Kb.Text
              type={Styles.isMobile ? 'BodySmallSemibold' : 'BodySmallSemiboldSecondaryLink'}
              onClick={onViewTeam}
            >
              {teamMeta.teamname}
            </Kb.Text>
          </Kb.Box2>

          <Kb.Box2
            direction="horizontal"
            gap="large"
            fullWidth={true}
            alignItems="flex-end"
            style={styles.headerTextContainer}
          >
            <Kb.Box2 direction="horizontal" gap="small">
              <Kb.Avatar size={64} username={username} />
              <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.headerText}>
                <Kb.ConnectedUsernames type="Header" usernames={[username]} />
                {!!member.fullName && (
                  <Kb.Text type="BodySemibold" lineClamp={1}>
                    {member.fullName}
                  </Kb.Text>
                )}
                <Kb.Text type="BodySmall">Joined 1m ago{/* TODO Y2K-1378 */}</Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
            {!Styles.isMobile && buttons}
          </Kb.Box2>
          {Styles.isMobile && buttons}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const BlockDropdown = (props: {username: string}) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBlock = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [{props: {username: props.username}, selected: 'chatBlockingModal'}],
      })
    )
  const {popup, popupAnchor, showingPopup, setShowingPopup} = Kb.usePopup(getAttachmentRef => (
    <Kb.FloatingMenu
      attachTo={getAttachmentRef}
      visible={showingPopup}
      onHidden={() => setShowingPopup(false)}
      closeOnSelect={true}
      items={[{danger: true, icon: 'iconfont-remove', onClick: onBlock, title: 'Block'}]}
    />
  ))
  return (
    <>
      <Kb.Button
        small={true}
        icon="iconfont-ellipsis"
        onClick={() => setShowingPopup(true)}
        mode="Secondary"
        ref={popupAnchor}
      />
      {popup}
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  headerContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
    },
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
      paddingBottom: Styles.globalMargins.small,
    },
    isMobile: {
      paddingTop: Styles.globalMargins.small,
    },
  }),
  headerContent: {
    ...Styles.padding(0, Styles.globalMargins.small),
  },
  headerText: Styles.platformStyles({
    isElectron: {
      width: 127,
    },
    isMobile: {
      flex: 1,
    },
  }),
  headerTextContainer: Styles.platformStyles({
    isMobile: {paddingBottom: Styles.globalMargins.tiny},
  }),
  listItem: {
    marginLeft: Styles.globalMargins.tiny,
  },
}))

export default TeamMember
