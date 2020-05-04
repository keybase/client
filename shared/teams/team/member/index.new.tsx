import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ProfileGen from '../../../actions/profile-gen'
import {useAllChannelMetas} from '../../common/channel-hooks'
import logger from '../../../logger'
import {pluralize} from '../../../util/string'
import {FloatingRolePicker} from '../../role-picker'
import RoleButton from '../../role-button'
import * as TeamsGen from '../../../actions/teams-gen'
import {useTeamDetailsSubscribe} from '../../subscriber'
import {formatTimeForTeamMember, formatTimeRelativeToNow} from '../../../util/timestamp'
import {Section as _Section} from '../../../common-adapters/section-list'
import isEqual from 'lodash/isEqual'

type Props = {
  teamID: Types.TeamID
  username: string
}
type OwnProps = Container.RouteProps<Props>

type TeamTreeRowNotIn = {
  teamID: Types.TeamID
  teamname: string
  memberCount?: number
  joinTime?: number
  canAdminister: boolean
}
type TeamTreeRowIn = {
  role: Types.TeamRoleType
} & TeamTreeRowNotIn

const getMemberships = (
  state: Container.TypedState,
  teamIDs: Array<Types.TeamID>,
  username: string
): Map<Types.TeamID, Types.TreeloaderSparseMemberInfo> => {
  const results = new Map<Types.TeamID, Types.TreeloaderSparseMemberInfo>()
  teamIDs.forEach(teamID => {
    const info = Constants.maybeGetSparseMemberInfo(state, teamID, username)
    if (info) {
      results.set(teamID, info)
    }
  })
  return results
}

type TreeMembershipOK = {s: RPCTypes.TeamTreeMembershipStatus.ok; ok: RPCTypes.TeamTreeMembershipValue}
const useMemberships = (targetTeamID: Types.TeamID, username: string) => {
  const errors: Array<RPCTypes.TeamTreeMembership> = []
  const nodesNotIn: Array<TeamTreeRowNotIn> = []
  const nodesIn: Array<TeamTreeRowIn> = []

  const memberships = Container.useSelector(state =>
    state.teams.teamMemberToTreeMemberships.get(targetTeamID)?.get(username)
  )
  const roleMap = Container.useSelector(state => state.teams.teamRoleMap.roles)
  const teamMetas = Container.useSelector(state => state.teams.teamMeta)

  // Note that we do not directly take any information directly from the TeamTree result other
  // than the **shape of the tree**. The other information is delegated to
  // Constants.maybeGetSparseMemberInfo which opportunistically sources the information from the
  // teamDetails map if present, so as to show up-to-date information.
  const teamIDs: Array<Types.TeamID> =
    memberships?.memberships
      .filter(m => m.result.s === RPCTypes.TeamTreeMembershipStatus.ok)
      .map(m => (m.result as TreeMembershipOK).ok.teamID) ?? []
  const upToDateSparseMemberInfos = Container.useSelector(
    state => getMemberships(state, teamIDs, username),
    isEqual // Since this makes a new map every time, do a deep equality comparison to see if it actually changed
  )

  if (!memberships) {
    return {errors, nodesIn, nodesNotIn}
  }

  for (const membership of memberships.memberships) {
    const teamname = membership?.teamName

    if (RPCTypes.TeamTreeMembershipStatus.ok === membership.result.s) {
      const teamID = membership.result.ok.teamID
      const sparseMemberInfo = upToDateSparseMemberInfos.get(teamID)
      if (!sparseMemberInfo) {
        continue
      }

      const ops = Constants.deriveCanPerform(roleMap.get(teamID))
      const row = {
        canAdminister: ops.manageMembers,
        joinTime: sparseMemberInfo.joinTime,
        // memberCount should always be populated because the TeamList, which is synced
        // eagerly, provides it.
        memberCount: teamMetas.get(teamID)?.memberCount,
        teamID,
        teamname,
      }

      if ('none' != sparseMemberInfo.type) {
        nodesIn.push({
          role: sparseMemberInfo.type,
          ...row,
        })
      } else {
        nodesNotIn.push(row)
      }
    } else if (RPCTypes.TeamTreeMembershipStatus.error == membership.result.s) {
      errors.push(membership)
    }
  }
  return {
    errors,
    nodesIn,
    nodesNotIn,
  }
}

const useNavUpIfRemovedFromTeam = (teamID: Types.TeamID, username: string) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const waitingKey = Constants.removeMemberWaitingKey(teamID, username)
  const waiting = Container.useAnyWaiting(waitingKey)
  const wasWaiting = Container.usePrevious(waiting)
  React.useEffect(() => {
    if (wasWaiting && !waiting) {
      dispatch(nav.safeNavigateUpPayload())
    }
  })
  return wasWaiting && !waiting
}

type Extra = {title: React.ReactElement}
type Section = _Section<TeamTreeRowIn, Extra> | _Section<TeamTreeRowNotIn, Extra>

const TeamMember = (props: OwnProps) => {
  const dispatch = Container.useDispatch()
  const username = Container.getRouteProps(props, 'username', '')
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)

  const isMe = username == Container.useSelector(state => state.config.username)
  const loading = Container.useSelector(state => {
    const memberships = state.teams.teamMemberToTreeMemberships.get(teamID)?.get(username)
    if (!memberships || !memberships.expectedCount) {
      return true
    }
    const got = memberships.memberships.length
    const want = memberships.expectedCount
    if (got > want) {
      logger.error(`got ${got} notifications for ${teamID}; only wanted ${want}`)
    }
    return got < want
  })

  // Load up the memberships when the page is opened
  React.useEffect(() => {
    dispatch(TeamsGen.createLoadTeamTree({teamID, username}))
  }, [teamID, username, dispatch])

  const {nodesIn, nodesNotIn, errors} = useMemberships(teamID, username)

  const [expandedSet, setExpandedSet] = React.useState(
    new Set<string>([teamID])
  )

  const makeTitle = label => {
    return (
      <Kb.Box2 direction="horizontal" alignItems="center" gap="small">
        <Kb.Text type="BodySmallSemibold">{label}</Kb.Text>
        {loading && <Kb.ProgressIndicator type="Small" />}
      </Kb.Box2>
    )
  }

  const nodesInSection: Section = {
    data: nodesIn,
    key: 'section-nodes',
    renderItem: ({item, index}: {item: TeamTreeRowIn; index: number}) => (
      <NodeInRow
        node={item}
        idx={index}
        isParentTeamMe={isMe && teamID == item.teamID}
        username={username}
        expanded={expandedSet.has(item.teamID)}
        setExpanded={newExpanded => {
          if (newExpanded) {
            expandedSet.add(item.teamID)
          } else {
            expandedSet.delete(item.teamID)
          }
          setExpandedSet(new Set([...expandedSet]))
        }}
      />
    ),
    title: makeTitle(isMe ? 'You are a member of:' : `${username} is a member of:`),
  }

  const nodesNotInSection = {
    data: nodesNotIn,
    key: 'section-add-nodes',
    renderItem: ({item, index}: {item: TeamTreeRowNotIn; index: number}) => (
      <NodeNotInRow node={item} idx={index} username={username} />
    ),
    title: makeTitle(isMe ? 'You are not in:' : `${username} is not in:`),
  }

  const sections = [
    ...(nodesIn.length > 0 ? [nodesInSection] : []),
    ...(nodesNotIn.length > 0 ? [nodesNotInSection] : []),
  ]
  return (
    <>
      {errors.length > 0 && (
        <Kb.Banner color="red">
          {loading ? <Kb.ProgressIndicator type="Small" /> : <></>}
          <Kb.BannerParagraph
            key="teamTreeErrorHeader"
            bannerColor="red"
            content={[
              'The following teams could not be loaded. ',
              {
                onClick: () => dispatch(TeamsGen.createLoadTeamTree({teamID, username})),
                text: 'Click to reload.',
              },
            ]}
          />
          <>
            {errors.map((error, idx) => {
              if (RPCTypes.TeamTreeMembershipStatus.error != error.result.s) {
                return <></>
              }

              const failedAt = [error.teamName]
              if (error.result.error.willSkipSubtree) {
                failedAt.push('its subteams')
              }
              if (error.result.error.willSkipAncestors) {
                failedAt.push('its parent teams')
              }
              var failedAtStr = ''
              if (failedAt.length > 1) {
                const last = failedAt.pop()
                failedAtStr = failedAt.join(', ') + ', and ' + last
              } else {
                failedAtStr = failedAt[0]
              }
              return (
                <Kb.BannerParagraph
                  key={'teamTreeErrorRow' + idx.toString()}
                  bannerColor="red"
                  content={'• ' + failedAtStr}
                />
              )
            })}
          </>
        </Kb.Banner>
      )}
      <Kb.SectionList<Section>
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({section}) => <Kb.SectionDivider label={section.title} />}
        sections={sections}
        keyExtractor={item => `member:${username}:${item.teamname}`}
      />
    </>
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

type NodeNotInRowProps = {
  idx: number
  node: TeamTreeRowNotIn
  username: string
}
const NodeNotInRow = (props: NodeNotInRowProps) => {
  useTeamDetailsSubscribe(props.node.teamID)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onAddWaitingKey = Constants.addMemberWaitingKey(props.node.teamID, props.username)
  const onAdd = (role: Types.TeamRoleType) =>
    dispatch(
      TeamsGen.createAddToTeam({
        sendChatNotification: true,
        teamID: props.node.teamID,
        users: [{assertion: props.username, role}],
      })
    )
  const openTeam = React.useCallback(
    () =>
      dispatch(
        nav.safeNavigateAppendPayload({
          path: [{props: {teamID: props.node.teamID}, selected: 'team'}],
        })
      ),
    [props.node.teamID, dispatch, nav]
  )

  const disabledRoles = Container.useSelector(state =>
    Constants.getDisabledReasonsForRolePicker(state, props.node.teamID, props.username)
  )

  const [open, setOpen] = React.useState(false)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.rowCollapsedFixedHeight}>
      {props.idx !== 0 && <Kb.Divider />}

      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        alignItems="stretch"
        style={Styles.collapseStyles([styles.row, styles.contentCollapsedFixedHeight])}
      >
        <Kb.Box2
          direction="horizontal"
          alignSelf="flex-start"
          alignItems="center"
          gap="tiny"
          style={Styles.collapseStyles([
            Styles.globalStyles.flexGrow,
            styles.inviteTeamInfo,
            styles.contentCollapsedFixedHeight,
          ])}
        >
          <Kb.Avatar teamname={props.node.teamname} size={32} />
          <Kb.Box2
            direction="vertical"
            alignItems="flex-start"
            style={Styles.collapseStyles([
              Styles.globalStyles.flexGrow,
              styles.membershipTeamText,
              styles.contentCollapsedFixedHeight,
            ])}
          >
            <Kb.Text type="BodySemiboldLink" onClick={openTeam} style={styles.teamNameLink}>
              {props.node.teamname}
            </Kb.Text>
            <Kb.Text type="BodySmall">
              {props.node.memberCount !== undefined
                ? `${props.node.memberCount.toLocaleString()} ${pluralize('member', props.node.memberCount)}`
                : 'Loading members...'}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>

        {props.node.canAdminister && (
          <Kb.Box2 direction="horizontal" alignSelf="center">
            <FloatingRolePicker
              presetRole="writer"
              onConfirm={role => {
                onAdd(role)
                setOpen(false)
              }}
              open={open}
              onCancel={() => setOpen(false)}
              disabledRoles={disabledRoles}
            >
              <Kb.WaitingButton
                label="Add"
                onClick={() => setOpen(!open)}
                small={true}
                style={styles.inviteButton}
                waitingKey={onAddWaitingKey}
              />
            </FloatingRolePicker>
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const LastActivity = (props: {loading: boolean; teamID: Types.TeamID; username: string}) => {
  const lastActivity = Container.useSelector(state =>
    Constants.getTeamMemberLastActivity(state, props.teamID, props.username)
  )

  return (
    <Kb.Text type="BodySmall">
      {props.loading
        ? 'Loading activity...'
        : lastActivity
        ? `Active ${formatTimeRelativeToNow(lastActivity)}`
        : 'No activity'}
    </Kb.Text>
  )
}
type NodeInRowProps = {
  idx: number
  isParentTeamMe: boolean
  node: TeamTreeRowIn
  username: string
  expanded: boolean
  setExpanded: (b: boolean) => void
}
const NodeInRow = (props: NodeInRowProps) => {
  const {channelMetas, loadingChannels} = useAllChannelMetas(
    props.node.teamID,
    !props.expanded /* dontCallRPC */
  )
  useTeamDetailsSubscribe(props.node.teamID)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onAddToChannels = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [
          {
            props: {teamID: props.node.teamID, usernames: [props.username]},
            selected: 'teamAddToChannels',
          },
        ],
      })
    )
  const onKickOutWaitingKey = Constants.removeMemberWaitingKey(props.node.teamID, props.username)
  const onKickOut = () => {
    dispatch(TeamsGen.createRemoveMember({teamID: props.node.teamID, username: props.username}))
    if (props.isParentTeamMe) {
      dispatch(nav.safeNavigateUpPayload())
    }
  }

  const openTeam = React.useCallback(
    () =>
      dispatch(
        nav.safeNavigateAppendPayload({
          path: [{props: {teamID: props.node.teamID}, selected: 'team'}],
        })
      ),
    [props.node.teamID, dispatch, nav]
  )

  const {expanded, setExpanded} = props

  const [role, setRole] = React.useState<Types.TeamRoleType>(props.node.role)
  const [open, setOpen] = React.useState(false)
  const onChangeRole = (role: Types.TeamRoleType) => {
    setRole(role)
    dispatch(TeamsGen.createEditMembership({role, teamID: props.node.teamID, usernames: [props.username]}))
    setOpen(false)
    if (['reader, writer'].includes(role) && props.isParentTeamMe) {
      dispatch(nav.safeNavigateUpPayload())
    }
  }
  const disabledRoles = Container.useSelector(state =>
    Constants.getDisabledReasonsForRolePicker(state, props.node.teamID, props.username)
  )
  const amLastOwner = Container.useSelector(state => Constants.isLastOwner(state, props.node.teamID))
  const isMe = props.username == Container.useSelector(state => state.config.username)
  const changingRole = Container.useAnyWaiting(
    Constants.editMembershipWaitingKey(props.node.teamID, props.username)
  )
  const loadingActivity = Container.useAnyWaiting(
    Constants.loadTeamTreeActivityWaitingKey(props.node.teamID, props.username)
  )

  const channelsJoined =
    Array.from(channelMetas)
      .map(([_, {channelname}]) => channelname)
      .join(', #') || 'general'

  const rolePicker = props.node.canAdminister ? (
    <RoleButton
      containerStyle={Styles.collapseStyles([styles.roleButton, expanded && styles.roleButtonExpanded])}
      loading={changingRole}
      onClick={() => setOpen(true)}
      selectedRole={role}
    />
  ) : (
    <></>
  )

  return (
    <>
      <FloatingRolePicker
        presetRole={props.node.role}
        onConfirm={onChangeRole}
        onCancel={() => {
          setOpen(false)
        }}
        position="top right"
        open={open}
        disabledRoles={disabledRoles}
      />
      <Kb.ClickableBox onClick={() => setExpanded(!expanded)}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={!expanded && styles.rowCollapsedFixedHeight}>
          {props.idx !== 0 && <Kb.Divider />}

          <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start" style={styles.row}>
            <Kb.Box2 direction="horizontal" style={Styles.collapseStyles([styles.expandIcon])}>
              <Kb.Icon type={expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'} sizeType="Tiny" />
            </Kb.Box2>

            <Kb.Box2
              direction="horizontal"
              style={Styles.collapseStyles([
                Styles.globalStyles.flexGrow,
                !expanded && styles.contentCollapsedFixedHeight,
                expanded && styles.membershipExpanded,
              ])}
            >
              <Kb.Box2
                direction="vertical"
                fullWidth={true}
                alignItems="flex-start"
                gap="tiny"
                style={!expanded && styles.contentCollapsedFixedHeight}
              >
                <Kb.Box2
                  direction="horizontal"
                  alignSelf="flex-start"
                  alignItems="center"
                  gap="tiny"
                  style={Styles.collapseStyles([
                    !expanded && styles.contentCollapsedFixedHeight,
                    expanded && styles.membershipContentExpanded,
                  ])}
                >
                  <Kb.Avatar teamname={props.node.teamname} size={32} />
                  <Kb.Box2
                    direction="vertical"
                    alignItems="flex-start"
                    style={Styles.collapseStyles([
                      styles.membershipTeamText,
                      expanded && styles.membershipTeamTextExpanded,
                      !expanded && styles.contentCollapsedFixedHeight,
                    ])}
                  >
                    <Kb.Text type="BodySemiboldLink" onClick={openTeam} style={styles.teamNameLink}>
                      {props.node.teamname}
                    </Kb.Text>
                    {!!props.node.joinTime && (
                      <Kb.Text type="BodySmall">
                        Joined {formatTimeForTeamMember(props.node.joinTime)}
                      </Kb.Text>
                    )}
                  </Kb.Box2>
                </Kb.Box2>
                {expanded && Styles.isPhone && (
                  <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start" alignItems="center">
                    {rolePicker}
                  </Kb.Box2>
                )}
                {expanded && (
                  <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start" alignItems="center">
                    <Kb.Icon
                      type="iconfont-typing"
                      sizeType="Small"
                      color={Styles.globalColors.black_20}
                      boxStyle={styles.membershipIcon}
                    />
                    <LastActivity
                      loading={loadingActivity}
                      teamID={props.node.teamID}
                      username={props.username}
                    />
                  </Kb.Box2>
                )}
                {expanded && (
                  <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start" fullWidth={true}>
                    <Kb.Icon
                      type="iconfont-hash"
                      sizeType="Small"
                      color={Styles.globalColors.black_20}
                      boxStyle={styles.membershipIcon}
                    />
                    <Kb.Text
                      type="BodySmall"
                      style={Styles.globalStyles.flexOne}
                      lineClamp={4}
                      ellipsizeMode="tail"
                    >
                      {loadingChannels ? 'Loading channels...' : `Member of #${channelsJoined}`}
                    </Kb.Text>
                  </Kb.Box2>
                )}
                {expanded && (props.node.canAdminister || isMe) && (
                  <Kb.Box2
                    direction="horizontal"
                    gap="tiny"
                    alignSelf="flex-start"
                    gapEnd={Styles.isMobile}
                    style={styles.paddingBottomMobile}
                  >
                    <Kb.Button
                      mode="Secondary"
                      onClick={onAddToChannels}
                      label="Add to channels"
                      small={true}
                    />
                    {!(isMe && amLastOwner) && (
                      <Kb.WaitingButton
                        mode="Secondary"
                        icon={isMe ? 'iconfont-team-leave' : 'iconfont-block'}
                        type="Danger"
                        onClick={onKickOut}
                        label={isMe ? 'Leave team' : 'Kick out'}
                        small={true}
                        waitingKey={onKickOutWaitingKey}
                      />
                    )}
                  </Kb.Box2>
                )}
              </Kb.Box2>
            </Kb.Box2>
            {!Styles.isPhone && (
              <Kb.Box2 direction="horizontal" alignSelf={expanded ? 'flex-start' : 'center'}>
                {rolePicker}
              </Kb.Box2>
            )}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.ClickableBox>
    </>
  )
}

// exported for stories
export const TeamMemberHeader = (props: Props) => {
  const {teamID, username} = props
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const leaving = useNavUpIfRemovedFromTeam(teamID, username)

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
    if (!leaving) {
      // loading? should never happen.
      logger.error('[team member view] no data! this should never happen.')
    }
    return null
  }

  const buttons = (
    <Kb.Box2 direction="horizontal" gap="tiny" alignSelf={Styles.isPhone ? 'flex-start' : 'flex-end'}>
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
            gap={Styles.isPhone ? 'tiny' : 'xtiny'}
            alignSelf="flex-start"
          >
            <Kb.Avatar size={16} teamname={teamMeta.teamname} />
            <Kb.Text
              type={Styles.isPhone ? 'BodySmallSemibold' : 'BodySmallSemiboldSecondaryLink'}
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
                <Kb.ConnectedUsernames type="Header" usernames={username} />
                {!!member.fullName && (
                  <Kb.Text type="BodySemibold" lineClamp={1}>
                    {member.fullName}
                  </Kb.Text>
                )}
                <Kb.Text type="BodySmall">
                  Joined {member.joinTime ? formatTimeForTeamMember(member.joinTime) : 'this team'}
                </Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
            {!Styles.isPhone && buttons}
          </Kb.Box2>
          {Styles.isPhone && buttons}
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
  contentCollapsedFixedHeight: Styles.platformStyles({
    common: {
      height: 48,
    },
    isPhone: {
      height: 64,
    },
  }),
  expandIcon: Styles.platformStyles({
    common: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      display: 'flex',
      flexShrink: 0,
      height: 48,
      justifyContent: 'center',
      padding: Styles.globalMargins.tiny,
      width: 40,
    },
    isPhone: {
      height: 64,
      padding: 0,
      width: 10 + Styles.globalMargins.small * 2, // 16px side paddings
    },
  }),
  headerContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      paddingBottom: Styles.globalMargins.small,
    },
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
    },
    isPhone: {
      paddingTop: Styles.globalMargins.small,
    },
    isTablet: {
      paddingTop: Styles.globalMargins.small,
    },
  }),
  headerContent: {
    ...Styles.padding(0, Styles.globalMargins.small),
  },
  headerText: Styles.platformStyles({
    common: {
      width: 127,
    },
    isPhone: {
      flex: 1,
    },
  }),
  headerTextContainer: Styles.platformStyles({
    isPhone: {paddingBottom: Styles.globalMargins.tiny},
  }),
  inviteButton: {
    minWidth: 56,
  },
  inviteTeamInfo: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.small,
    },
  }),
  membershipContentExpanded: Styles.platformStyles({
    common: {
      height: 40,
      paddingTop: Styles.globalMargins.tiny,
    },
    isPhone: {
      height: 48,
      paddingTop: Styles.globalMargins.small,
    },
  }),
  membershipExpanded: Styles.platformStyles({
    isElectron: {
      paddingBottom: Styles.globalMargins.tiny,
    },
    isTablet: {
      paddingBottom: Styles.globalMargins.tiny,
    },
  }),
  membershipIcon: {
    flexShrink: 0,
    paddingTop: Styles.globalMargins.xtiny,
  },
  membershipTeamText: {
    justifyContent: 'center',
  },
  membershipTeamTextExpanded: Styles.platformStyles({
    isMobile: {
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
  paddingBottomMobile: Styles.platformStyles({
    isPhone: {
      paddingBottom: Styles.globalMargins.small,
    },
  }),
  reloadButton: {
    marginTop: Styles.globalMargins.tiny,
    minWidth: 56,
  },
  roleButton: {
    paddingRight: 0,
  },
  roleButtonExpanded: Styles.platformStyles({
    isElectron: {
      marginTop: 10, // does not exist as an official size
    },
    isTablet: {
      marginTop: 10, // does not exist as an official size
    },
  }),
  row: {paddingRight: Styles.globalMargins.small},
  rowCollapsedFixedHeight: Styles.platformStyles({
    common: {
      height: 49,
    },
    isPhone: {
      flexShrink: 0,
      height: 65,
    },
  }),
  teamNameLink: {
    color: Styles.globalColors.black,
  },
}))

export default TeamMember
