import * as C from '@/constants'
import * as Container from '@/util/container'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import RoleButton from '../../role-button'
import logger from '@/logger'
import {FloatingRolePicker} from '../../role-picker'
import {formatTimeForTeamMember, formatTimeRelativeToNow} from '@/util/timestamp'
import {pluralize} from '@/util/string'
import {useAllChannelMetas} from '@/teams/common/channel-hooks'
import {useTeamDetailsSubscribe} from '@/teams/subscriber'
import {createAnimatedComponent} from '@/common-adapters/reanimated'
import type {Props as SectionListProps, Section as SectionType} from '@/common-adapters/section-list'

type Props = {
  teamID: T.Teams.TeamID
  username: string
}
type OwnProps = {
  teamID: T.Teams.TeamID
  username: string
}

type TeamTreeRowNotIn = {
  teamID: T.Teams.TeamID
  teamname: string
  memberCount?: number
  joinTime?: number
  canAdminister: boolean
}
type TeamTreeRowIn = {
  role: T.Teams.TeamRoleType
} & TeamTreeRowNotIn
type Either = TeamTreeRowNotIn & {role?: T.Teams.TeamRoleType}

const getMemberships = (
  state: C.Teams.State,
  teamIDs: Array<T.Teams.TeamID>,
  username: string
): Map<T.Teams.TeamID, T.Teams.TreeloaderSparseMemberInfo> => {
  const results = new Map<T.Teams.TeamID, T.Teams.TreeloaderSparseMemberInfo>()
  teamIDs.forEach(teamID => {
    const info = C.Teams.maybeGetSparseMemberInfo(state, teamID, username)
    if (info) {
      results.set(teamID, info)
    }
  })
  return results
}

type TreeMembershipOK = {s: T.RPCGen.TeamTreeMembershipStatus.ok; ok: T.RPCGen.TeamTreeMembershipValue}
const useMemberships = (targetTeamID: T.Teams.TeamID, username: string) => {
  const errors: Array<T.RPCGen.TeamTreeMembership> = []
  const nodesNotIn: Array<TeamTreeRowNotIn> = []
  const nodesIn: Array<TeamTreeRowIn> = []

  const memberships = C.useTeamsState(s => s.teamMemberToTreeMemberships.get(targetTeamID)?.get(username))
  const roleMap = C.useTeamsState(s => s.teamRoleMap.roles)
  const teamMetas = C.useTeamsState(s => s.teamMeta)

  // Note that we do not directly take any information directly from the TeamTree result other
  // than the **shape of the tree**. The other information is delegated to
  // C.Teams.maybeGetSparseMemberInfo which opportunistically sources the information from the
  // teamDetails map if present, so as to show up-to-date information.
  const teamIDs: Array<T.Teams.TeamID> =
    memberships?.memberships
      .filter(m => m.result.s === T.RPCGen.TeamTreeMembershipStatus.ok)
      .map(m => (m.result as TreeMembershipOK).ok.teamID) ?? []
  const upToDateSparseMemberInfos = C.useTeamsState(C.useDeep(s => getMemberships(s, teamIDs, username)))

  if (!memberships) {
    return {errors, nodesIn, nodesNotIn}
  }

  for (const membership of memberships.memberships) {
    const teamname = membership.teamName

    if (T.RPCGen.TeamTreeMembershipStatus.ok === membership.result.s) {
      const teamID = membership.result.ok.teamID
      const sparseMemberInfo = upToDateSparseMemberInfos.get(teamID)
      if (!sparseMemberInfo) {
        continue
      }

      const ops = C.Teams.deriveCanPerform(roleMap.get(teamID))
      const row = {
        canAdminister: ops.manageMembers,
        joinTime: sparseMemberInfo.joinTime,
        // memberCount should always be populated because the TeamList, which is synced
        // eagerly, provides it.
        memberCount: teamMetas.get(teamID)?.memberCount,
        teamID,
        teamname,
      }

      if ('none' !== sparseMemberInfo.type) {
        nodesIn.push({
          role: sparseMemberInfo.type,
          ...row,
        })
      } else {
        nodesNotIn.push(row)
      }
    } else if (T.RPCGen.TeamTreeMembershipStatus.error === membership.result.s) {
      errors.push(membership)
    }
  }
  return {
    errors,
    nodesIn,
    nodesNotIn,
  }
}

const useNavUpIfRemovedFromTeam = (teamID: T.Teams.TeamID, username: string) => {
  const nav = Container.useSafeNavigation()
  const waitingKey = C.Teams.removeMemberWaitingKey(teamID, username)
  const waiting = C.Waiting.useAnyWaiting(waitingKey)
  const wasWaiting = Container.usePrevious(waiting)
  React.useEffect(() => {
    if (wasWaiting && !waiting) {
      nav.safeNavigateUp()
    }
  })
  return wasWaiting && !waiting
}

type Extra = {title: React.ReactElement}
type Section = SectionType<Either, Extra>

const SectionList = createAnimatedComponent<SectionListProps<Section>>(Kb.SectionList)

const TeamMember = (props: OwnProps) => {
  const username = props.username
  const teamID = props.teamID
  const isMe = username === C.useCurrentUserState(s => s.username)
  const loading = C.useTeamsState(s => {
    const memberships = s.teamMemberToTreeMemberships.get(teamID)?.get(username)
    if (!memberships?.expectedCount) {
      return true
    }
    const got = memberships.memberships.length
    const want = memberships.expectedCount
    if (got > want) {
      logger.error(`got ${got} notifications for ${teamID}; only wanted ${want}`)
    }
    return got < want
  })

  const loadTeamTree = C.useTeamsState(s => s.dispatch.loadTeamTree)

  // Load up the memberships when the page is opened
  React.useEffect(() => {
    loadTeamTree(teamID, username)
  }, [loadTeamTree, teamID, username])

  const {nodesIn, nodesNotIn, errors} = useMemberships(teamID, username)

  const [expandedSet, setExpandedSet] = React.useState(new Set<string>())

  const makeTitle = (label: string) => {
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
    renderItem: ({item, index}) => (
      <NodeInRow
        node={item as TeamTreeRowIn}
        idx={index}
        isParentTeamMe={isMe && teamID === item.teamID}
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
    renderItem: ({item, index}: {item: Either; index: number}) => (
      <NodeNotInRow node={item as TeamTreeRowNotIn} idx={index} username={username} />
    ),
    title: makeTitle(isMe ? 'You are not in:' : `${username} is not in:`),
  }

  const sections = [
    ...(nodesIn.length > 0 ? [nodesInSection] : []),
    ...(nodesNotIn.length > 0 ? [nodesNotInSection] : []),
  ]
  return (
    <Kb.Box2 direction="vertical" fullHeight={true} style={styles.container}>
      {errors.length > 0 && (
        <Kb.Banner color="red">
          {loading ? <Kb.ProgressIndicator type="Small" /> : <></>}
          <Kb.BannerParagraph
            key="teamTreeErrorHeader"
            bannerColor="red"
            content={[
              'The following teams could not be loaded. ',
              {
                onClick: () => loadTeamTree(teamID, username),
                text: 'Click to reload.',
              },
            ]}
          />
          <>
            {errors.map((error, idx) => {
              if (T.RPCGen.TeamTreeMembershipStatus.error !== error.result.s) {
                return <></>
              }

              const failedAt = [error.teamName]
              if (error.result.error.willSkipSubtree) {
                failedAt.push('its subteams')
              }
              if (error.result.error.willSkipAncestors) {
                failedAt.push('its parent teams')
              }
              let failedAtStr = ''
              if (failedAt.length > 1) {
                const last = failedAt.pop()
                failedAtStr = failedAt.join(', ') + ', and ' + last
              } else {
                failedAtStr = failedAt[0] ?? ''
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
      <SectionList
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({section}) => <Kb.SectionDivider label={section.title} />}
        sections={sections}
        ListHeaderComponent={<TeamMemberHeader teamID={teamID} username={username} />}
        keyExtractor={item => `member:${username}:${item.teamname}`}
      />
    </Kb.Box2>
  )
}

type NodeNotInRowProps = {
  idx: number
  node: TeamTreeRowNotIn
  username: string
}
const NodeNotInRow = (props: NodeNotInRowProps) => {
  useTeamDetailsSubscribe(props.node.teamID)
  const nav = Container.useSafeNavigation()
  const onAddWaitingKey = C.Teams.addMemberWaitingKey(props.node.teamID, props.username)
  const addToTeam = C.useTeamsState(s => s.dispatch.addToTeam)
  const onAdd = (role: T.Teams.TeamRoleType) => {
    addToTeam(props.node.teamID, [{assertion: props.username, role}], true)
  }
  const openTeam = React.useCallback(
    () => nav.safeNavigateAppend({props: {teamID: props.node.teamID}, selected: 'team'}),
    [props.node.teamID, nav]
  )
  const disabledRoles = C.useTeamsState(s =>
    C.Teams.getDisabledReasonsForRolePicker(s, props.node.teamID, props.username)
  )
  const [open, setOpen] = React.useState(false)

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.rowCollapsedFixedHeight}>
      {props.idx !== 0 && <Kb.Divider />}

      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        alignItems="stretch"
        style={Kb.Styles.collapseStyles([styles.row, styles.contentCollapsedFixedHeight])}
      >
        <Kb.Box2
          direction="horizontal"
          alignSelf="flex-start"
          alignItems="center"
          gap="tiny"
          style={Kb.Styles.collapseStyles([
            Kb.Styles.globalStyles.flexGrow,
            styles.inviteTeamInfo,
            styles.contentCollapsedFixedHeight,
          ] as const)}
        >
          <Kb.Avatar teamname={props.node.teamname} size={32} />
          <Kb.Box2
            direction="vertical"
            alignItems="flex-start"
            style={Kb.Styles.collapseStyles([
              Kb.Styles.globalStyles.flexOne,
              styles.membershipTeamText,
              styles.contentCollapsedFixedHeight,
            ])}
          >
            <Kb.Text type="BodySemiboldLink" onClick={openTeam} style={styles.teamNameLink} lineClamp={1}>
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

const LastActivity = (props: {loading: boolean; teamID: T.Teams.TeamID; username: string}) => {
  const lastActivity = C.useTeamsState(s =>
    C.Teams.getTeamMemberLastActivity(s, props.teamID, props.username)
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

  const nav = Container.useSafeNavigation()
  const onAddToChannels = () =>
    nav.safeNavigateAppend({
      props: {teamID: props.node.teamID, usernames: [props.username]},
      selected: 'teamAddToChannels',
    })
  const onKickOutWaitingKey = C.Teams.removeMemberWaitingKey(props.node.teamID, props.username)
  const removeMember = C.useTeamsState(s => s.dispatch.removeMember)
  const onKickOut = () => {
    removeMember(props.node.teamID, props.username)
    if (props.isParentTeamMe) {
      nav.safeNavigateUp()
    }
  }

  const openTeam = React.useCallback(
    () => nav.safeNavigateAppend({props: {teamID: props.node.teamID}, selected: 'team'}),
    [props.node.teamID, nav]
  )

  const {expanded, setExpanded} = props

  const [role, setRole] = React.useState<T.Teams.TeamRoleType>(props.node.role)
  const [open, setOpen] = React.useState(false)
  const editMembership = C.useTeamsState(s => s.dispatch.editMembership)
  const onChangeRole = (role: T.Teams.TeamRoleType) => {
    setRole(role)
    editMembership(props.node.teamID, [props.username], role)
    setOpen(false)
    if (['reader, writer'].includes(role) && props.isParentTeamMe) {
      nav.safeNavigateUp()
    }
  }
  const disabledRoles = C.useTeamsState(s =>
    C.Teams.getDisabledReasonsForRolePicker(s, props.node.teamID, props.username)
  )
  const amLastOwner = C.useTeamsState(s => C.Teams.isLastOwner(s, props.node.teamID))
  const isMe = props.username === C.useCurrentUserState(s => s.username)
  const changingRole = C.Waiting.useAnyWaiting(C.Teams.editMembershipWaitingKey(props.node.teamID, props.username))
  const loadingActivity = C.Waiting.useAnyWaiting(
    C.Teams.loadTeamTreeActivityWaitingKey(props.node.teamID, props.username)
  )

  const isSmallTeam = !C.useChatState(s => C.Chat.isBigTeam(s, props.node.teamID))
  const channelsJoined = isSmallTeam
    ? ''
    : Array.from(channelMetas)
        .map(([_, {channelname}]) => channelname)
        .join(', #')

  const rolePicker = props.node.canAdminister ? (
    <RoleButton
      containerStyle={Kb.Styles.collapseStyles([styles.roleButton, expanded && styles.roleButtonExpanded])}
      loading={changingRole}
      onClick={() => setOpen(true)}
      selectedRole={role}
    />
  ) : (
    <></>
  )

  const myRole = C.useTeamsState(s => C.Teams.getRole(s, props.node.teamID))
  const cantKickOut = props.node.canAdminister && props.node.role === 'owner' && myRole !== 'admin'

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
        floatingContainerStyle={styles.floatingContainerStyle}
      />
      <Kb.ClickableBox onClick={() => setExpanded(!expanded)}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={!expanded && styles.rowCollapsedFixedHeight}>
          {props.idx !== 0 && <Kb.Divider />}

          <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start" style={styles.row}>
            <Kb.Box2 direction="horizontal" style={Kb.Styles.collapseStyles([styles.expandIcon])}>
              <Kb.Icon type={expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'} sizeType="Tiny" />
            </Kb.Box2>
            <Kb.Box2
              direction="horizontal"
              style={Kb.Styles.collapseStyles([
                {flexGrow: 1, flexShrink: 1},
                !expanded && styles.contentCollapsedFixedHeight,
                expanded && styles.membershipExpanded,
              ] as const)}
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
                  style={Kb.Styles.collapseStyles([
                    !expanded && styles.contentCollapsedFixedHeight,
                    expanded && styles.membershipContentExpanded,
                  ] as const)}
                >
                  <Kb.Avatar teamname={props.node.teamname} size={32} />
                  <Kb.Box2
                    direction="vertical"
                    alignItems="flex-start"
                    style={Kb.Styles.collapseStyles([
                      styles.membershipTeamText,
                      expanded && styles.membershipTeamTextExpanded,
                      !expanded && styles.contentCollapsedFixedHeight,
                    ] as const)}
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
                {expanded && Kb.Styles.isPhone && (
                  <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start" alignItems="center">
                    {rolePicker}
                  </Kb.Box2>
                )}
                {expanded && (
                  <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start" alignItems="center">
                    <Kb.Icon
                      type="iconfont-typing"
                      sizeType="Small"
                      color={Kb.Styles.globalColors.black_20}
                      boxStyle={styles.membershipIcon}
                    />
                    <LastActivity
                      loading={loadingActivity}
                      teamID={props.node.teamID}
                      username={props.username}
                    />
                  </Kb.Box2>
                )}
                {expanded && !isSmallTeam && (
                  <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start" fullWidth={true}>
                    <Kb.Icon
                      type="iconfont-hash"
                      sizeType="Small"
                      color={Kb.Styles.globalColors.black_20}
                      boxStyle={styles.membershipIcon}
                    />
                    <Kb.Text
                      type="BodySmall"
                      style={Kb.Styles.globalStyles.flexOne}
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
                    gapEnd={Kb.Styles.isMobile}
                    style={styles.paddingBottomMobile}
                  >
                    {!isSmallTeam && (
                      <Kb.Button
                        mode="Secondary"
                        onClick={onAddToChannels}
                        label={isMe ? 'Join channels' : 'Add to channels'}
                        small={true}
                      />
                    )}
                    {!(isMe && amLastOwner) && !cantKickOut && (
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
            {!Kb.Styles.isPhone && (
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
  const nav = Container.useSafeNavigation()
  const leaving = useNavUpIfRemovedFromTeam(teamID, username)

  const teamMeta = C.useTeamsState(s => C.Teams.getTeamMeta(s, teamID))
  const teamDetails = C.useTeamsState(s => s.teamDetails.get(teamID))
  const yourUsername = C.useCurrentUserState(s => s.username)

  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const onChat = () => previewConversation({participants: [username], reason: 'memberView'})
  const onViewProfile = () => showUserProfile(username)
  const onViewTeam = () => nav.safeNavigateAppend({props: {teamID}, selected: 'team'})

  const member = teamDetails?.members.get(username)
  if (!member) {
    if (!leaving) {
      // loading? should never happen.
      logger.error('[team member view] no data! this should never happen.')
    }
    return null
  }

  const buttons = (
    <Kb.Box2 direction="horizontal" gap="tiny" alignSelf={Kb.Styles.isPhone ? 'flex-start' : 'flex-end'}>
      <Kb.Button small={true} label="Chat" onClick={onChat} />
      <Kb.Button small={true} label="View profile" onClick={onViewProfile} mode="Secondary" />
      {username !== yourUsername && <BlockDropdown username={username} />}
    </Kb.Box2>
  )

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.headerContainer}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContent}>
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
          <Kb.Box2
            direction="horizontal"
            alignItems="center"
            gap={Kb.Styles.isPhone ? 'tiny' : 'xtiny'}
            alignSelf="flex-start"
          >
            <Kb.Avatar size={16} teamname={teamMeta.teamname} />
            <Kb.Text
              type={Kb.Styles.isPhone ? 'BodySmallSemibold' : 'BodySmallSemiboldSecondaryLink'}
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
            {!Kb.Styles.isPhone && buttons}
          </Kb.Box2>
          {Kb.Styles.isPhone && buttons}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const BlockDropdown = (props: {username: string}) => {
  const {username} = props
  const nav = Container.useSafeNavigation()
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      const onBlock = () => nav.safeNavigateAppend({props: {username}, selected: 'chatBlockingModal'})
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          visible={true}
          onHidden={hidePopup}
          closeOnSelect={true}
          items={[{danger: true, icon: 'iconfont-remove', onClick: onBlock, title: 'Block'}]}
        />
      )
    },
    [nav, username]
  )
  const {popup, popupAnchor, showPopup} = Kb.usePopup2(makePopup)
  return (
    <>
      <Kb.Button
        small={true}
        icon="iconfont-ellipsis"
        onClick={showPopup}
        mode="Secondary"
        ref={popupAnchor}
      />
      {popup}
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  backButton: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  container: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    flex: 1,
    position: 'relative',
    width: '100%',
  },
  contentCollapsedFixedHeight: Kb.Styles.platformStyles({
    common: {height: 48},
    isPhone: {height: 64},
  }),
  expandIcon: Kb.Styles.platformStyles({
    common: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      display: 'flex',
      flexShrink: 0,
      height: 48,
      justifyContent: 'center',
      padding: Kb.Styles.globalMargins.tiny,
      width: 40,
    },
    isPhone: {
      height: 64,
      padding: 0,
      width: 10 + Kb.Styles.globalMargins.small * 2, // 16px side paddings
    },
  }),
  floatingContainerStyle: Kb.Styles.platformStyles({
    isElectron: {
      position: 'relative',
      right: Kb.Styles.globalMargins.tiny,
    },
  }),
  headerContainer: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.white,
      paddingBottom: Kb.Styles.globalMargins.small,
    },
    isElectron: {...Kb.Styles.desktopStyles.windowDraggingClickable},
    isPhone: {paddingTop: Kb.Styles.globalMargins.small},
    isTablet: {paddingTop: Kb.Styles.globalMargins.small},
  }),
  headerContent: {...Kb.Styles.padding(0, Kb.Styles.globalMargins.small)},
  headerText: Kb.Styles.platformStyles({
    common: {width: 127},
    isPhone: {flex: 1},
  }),
  headerTextContainer: Kb.Styles.platformStyles({
    isPhone: {paddingBottom: Kb.Styles.globalMargins.tiny},
  }),
  inviteButton: {minWidth: 56},
  inviteTeamInfo: Kb.Styles.platformStyles({
    common: {paddingLeft: Kb.Styles.globalMargins.small},
  }),
  membershipContentExpanded: Kb.Styles.platformStyles({
    common: {
      height: 40,
      paddingTop: Kb.Styles.globalMargins.tiny,
    },
    isPhone: {
      height: 48,
      paddingTop: Kb.Styles.globalMargins.small,
    },
  }),
  membershipExpanded: Kb.Styles.platformStyles({
    isElectron: {paddingBottom: Kb.Styles.globalMargins.tiny},
    isTablet: {paddingBottom: Kb.Styles.globalMargins.tiny},
  }),
  membershipIcon: {
    flexShrink: 0,
    paddingTop: Kb.Styles.globalMargins.xtiny,
  },
  membershipTeamText: {justifyContent: 'center'},
  membershipTeamTextExpanded: Kb.Styles.platformStyles({
    isMobile: {paddingTop: Kb.Styles.globalMargins.tiny},
  }),
  mobileHeader: {
    backgroundColor: Kb.Styles.globalColors.white,
    height: 40,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  paddingBottomMobile: Kb.Styles.platformStyles({
    isPhone: {paddingBottom: Kb.Styles.globalMargins.small},
  }),
  reloadButton: {
    marginTop: Kb.Styles.globalMargins.tiny,
    minWidth: 56,
  },
  roleButton: {paddingRight: 0},
  roleButtonExpanded: Kb.Styles.platformStyles({
    isElectron: {
      marginTop: 10, // does not exist as an official size
    },
    isTablet: {
      marginTop: 10, // does not exist as an official size
    },
  }),
  row: {paddingRight: Kb.Styles.globalMargins.small},
  rowCollapsedFixedHeight: Kb.Styles.platformStyles({
    common: {height: 49},
    isPhone: {
      flexShrink: 0,
      height: 65,
    },
  }),
  smallHeader: {...Kb.Styles.padding(0, Kb.Styles.globalMargins.xlarge)},
  teamNameLink: {color: Kb.Styles.globalColors.black},
}))

export default TeamMember
