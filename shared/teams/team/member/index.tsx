import * as C from '@/constants'
import {isBigTeam} from '@/constants/chat/helpers'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import {useCurrentUserState} from '@/stores/current-user'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import * as React from 'react'
import RoleButton from '../../role-button'
import {FloatingRolePicker} from '../../role-picker'
import {formatTimeForTeamMember, formatTimeRelativeToNow} from '@/util/timestamp'
import {pluralize} from '@/util/string'
import {useAllChannelMetas} from '@/teams/common/channel-hooks'
import {useSafeNavigation} from '@/util/safe-navigation'
import {getRolePickerDisabledReasons, isLastOwnerInTeamMembers} from '@/teams/role-picker-utils'
import {useLoadedTeam} from '../use-loaded-team'
import {removeMember} from '@/teams/actions'
import {TeamMemberHeader} from './header'
import {
  useTeamTreeMemberships,
  type TeamTreeRowIn,
  type TeamTreeRowNotIn,
} from './use-team-tree-memberships'

type Props = {
  teamID: T.Teams.TeamID
  username: string
}

type Item = {type: 'section-nodes'; tri: TeamTreeRowIn} | {type: 'section-add-nodes'; tni: TeamTreeRowNotIn}
type Section = Kb.SectionType<Item>

const TeamMember = (props: Props) => {
  const username = props.username
  const teamID = props.teamID
  const isMe = username === useCurrentUserState(s => s.username)
  const {errors, loading, nodesIn, nodesNotIn, reload} = useTeamTreeMemberships(teamID, username)

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
    data: nodesIn.map(n => ({tri: n, type: 'section-nodes'})),
    renderItem: ({item, index}: {item: Item; index: number}) =>
      item.type === 'section-nodes' ? (
        <NodeInRow
          node={item.tri}
          idx={index}
          isParentTeamMe={isMe && teamID === item.tri.teamID}
          username={username}
          expanded={expandedSet.has(item.tri.teamID)}
          setExpanded={newExpanded => {
            if (newExpanded) {
              expandedSet.add(item.tri.teamID)
            } else {
              expandedSet.delete(item.tri.teamID)
            }
            setExpandedSet(new Set([...expandedSet]))
          }}
        />
      ) : null,
    title: makeTitle(isMe ? 'You are a member of:' : `${username} is a member of:`),
  }

  const nodesNotInSection: Section = {
    data: nodesNotIn.map(n => ({
      tni: n,
      type: 'section-add-nodes',
    })),
    renderItem: ({item, index}: {item: Item; index: number}) =>
      item.type === 'section-add-nodes' ? (
        <NodeNotInRow node={item.tni} idx={index} username={username} />
      ) : null,
    title: makeTitle(isMe ? 'You are not in:' : `${username} is not in:`),
  }

  const sections: Array<Section> = nodesNotIn.length > 0 ? [nodesInSection, nodesNotInSection] : [nodesInSection]
  return (
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} flex={1} relative={true} testID={TestIDs.TEAMS_MEMBER_PAGE}>
      {errors.length > 0 && (
        <Kb.Banner color="red">
          {loading ? <Kb.ProgressIndicator type="Small" /> : <></>}
          <Kb.BannerParagraph
            key="teamTreeErrorHeader"
            bannerColor="red"
            content={[
              'The following teams could not be loaded. ',
              {
                onClick: reload,
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
              let failedAtStr: string
              if (failedAt.length > 1) {
                const last = failedAt.pop() ?? ''
                failedAtStr = `${failedAt.join(', ')}, and ${last}`
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
      <Kb.SectionList
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({section}) => <Kb.SectionDivider label={section.title} />}
        sections={sections}
        ListHeaderComponent={<TeamMemberHeader teamID={teamID} username={username} />}
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
  const currentUsername = useCurrentUserState(s => s.username)
  const {teamDetails, teamMeta, yourOperations} = useLoadedTeam(props.node.teamID)
  const nav = useSafeNavigation()
  const onAddWaitingKey = C.waitingKeyTeamsAddMember(props.node.teamID, props.username)
  const disabledRoles = getRolePickerDisabledReasons({
    canManageMembers: yourOperations.manageMembers,
    currentUsername,
    members: teamDetails.members,
    membersToModify: props.username,
    teamname: teamMeta.teamname,
  })
  const addToTeam = C.useRPC(T.RPCGen.teamsTeamAddMembersMultiRoleRpcPromise)
  const [error, setError] = React.useState('')
  const navigateAppend = C.Router2.navigateAppend
  const onAdd = (role: T.Teams.TeamRoleType) => {
    setError('')
    addToTeam(
      [
        {
          sendChatNotification: true,
          teamID: props.node.teamID,
          users: [{assertion: props.username, role: T.RPCGen.TeamRole[role]}],
        },
        [C.waitingKeyTeamsTeam(props.node.teamID), onAddWaitingKey],
      ],
      res => {
        const usernames = res.notAdded?.map(user => user.username) ?? []
        if (usernames.length) {
          navigateAppend({name: 'contactRestricted', params: {source: 'teamAddSomeFailed', usernames}})
        }
      },
      err => {
        if (err.code === T.RPCGen.StatusCode.scteamcontactsettingsblock) {
          const users = (err.fields as Array<{key?: string; value?: string} | undefined> | undefined)
            ?.filter(field => field?.key === 'usernames')
            .map(field => field?.value)
          const usernames = users?.[0]?.split(',') ?? []
          navigateAppend({name: 'contactRestricted', params: {source: 'teamAddAllFailed', usernames}})
          return
        }
        setError(err.message)
      }
    )
  }
  const openTeam = () => nav.safeNavigateAppend({name: 'team', params: {teamID: props.node.teamID}})
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

        {yourOperations.manageMembers && (
          <Kb.Box2 direction="vertical" alignSelf="center" gap="xtiny" alignItems="flex-end">
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
            {!!error && <Kb.Text type="BodySmallError">{error}</Kb.Text>}
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const LastActivity = (props: {lastActivity?: number; loading: boolean}) => {
  return (
    <Kb.Text type="BodySmall">
      {props.loading
        ? 'Loading activity...'
        : props.lastActivity
          ? `Active ${formatTimeRelativeToNow(props.lastActivity)}`
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
  const currentUsername = useCurrentUserState(s => s.username)
  const {teamDetails, teamMeta, yourOperations} = useLoadedTeam(props.node.teamID)
  const {channelMetas, loadingChannels} = useAllChannelMetas(
    props.node.teamID,
    !props.expanded /* dontCallRPC */
  )

  const nav = useSafeNavigation()
  const onAddToChannels = () =>
    nav.safeNavigateAppend({
      name: 'teamAddToChannels',
      params: {teamID: props.node.teamID, usernames: [props.username]},
    })
  const onKickOutWaitingKey = C.waitingKeyTeamsRemoveMember(props.node.teamID, props.username)
  const onKickOut = () => {
    removeMember(props.node.teamID, props.username)
    if (props.isParentTeamMe) {
      nav.safeNavigateUp()
    }
  }

  const openTeam = () => nav.safeNavigateAppend({name: 'team', params: {teamID: props.node.teamID}})

  const {expanded, setExpanded} = props

  const [role, setRole] = React.useState<T.Teams.TeamRoleType>(props.node.role)
  const [open, setOpen] = React.useState(false)
  const disabledRoles = getRolePickerDisabledReasons({
    canManageMembers: yourOperations.manageMembers,
    currentUsername,
    members: teamDetails.members,
    membersToModify: props.username,
    teamname: teamMeta.teamname,
  })
  const myRole = teamMeta.role
  const amLastOwner = myRole === 'owner' && isLastOwnerInTeamMembers(teamDetails.members, currentUsername)
  const isMe = props.username === currentUsername
  const isSmallTeam = !useInboxLayoutState(s => isBigTeam(s.layout, props.node.teamID))
  const editMembership = C.useRPC(T.RPCGen.teamsTeamEditMembersRpcPromise)
  const [error, setError] = React.useState('')
  const onChangeRole = (nextRole: T.Teams.TeamRoleType) => {
    const previousRole = role
    setError('')
    setRole(nextRole)
    editMembership(
      [
        {
          teamID: props.node.teamID,
          users: [{assertion: props.username, role: T.RPCGen.TeamRole[nextRole]}],
        },
        [
          C.waitingKeyTeamsTeam(props.node.teamID),
          C.waitingKeyTeamsEditMembership(props.node.teamID, props.username),
        ],
      ],
      () => {},
      err => {
        setRole(previousRole)
        setError(err.message)
      }
    )
    setOpen(false)
    if (['reader', 'writer'].includes(nextRole) && props.isParentTeamMe) {
      nav.safeNavigateUp()
    }
  }
  const changingRole = C.Waiting.useAnyWaiting(
    C.waitingKeyTeamsEditMembership(props.node.teamID, props.username)
  )
  const loadingActivity = C.Waiting.useAnyWaiting(
    C.waitingKeyTeamsLoadTeamTreeActivity(props.node.teamID, props.username)
  )
  const channelsJoined = isSmallTeam
    ? ''
    : Array.from(channelMetas)
        .map(([_, {channelname}]) => channelname)
        .join(', #')

  const canAdminister = yourOperations.manageMembers
  const rolePicker = canAdminister ? (
    <RoleButton
      containerStyle={Kb.Styles.collapseStyles([styles.roleButton, expanded && styles.roleButtonExpanded])}
      loading={changingRole}
      onClick={() => setOpen(true)}
      selectedRole={role}
    />
  ) : (
    <></>
  )

  const cantKickOut = canAdminister && props.node.role === 'owner' && myRole !== 'admin'

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
      <Kb.ClickableBox onClick={() => setExpanded(!expanded)} direction="vertical" fullWidth={true} style={!expanded && styles.rowCollapsedFixedHeight}>
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
                    />
                    <LastActivity lastActivity={props.node.lastActivity} loading={loadingActivity} />
                  </Kb.Box2>
                )}
                {expanded && !isSmallTeam && (
                  <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start" fullWidth={true}>
                    <Kb.Icon type="iconfont-hash" sizeType="Small" color={Kb.Styles.globalColors.black_20} />
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
                {expanded && (canAdminister || isMe) && (
                  <Kb.Box2
                    direction="horizontal"
                    gap="tiny"
                    alignSelf="flex-start"
                    gapEnd={isMobile}
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
                        type="Danger"
                        onClick={onKickOut}
                        label={isMe ? 'Leave team' : 'Kick out'}
                        small={true}
                        waitingKey={onKickOutWaitingKey}
                      >
                        <Kb.Icon
                          type={isMe ? 'iconfont-team-leave' : 'iconfont-block'}
                          sizeType="Small"
                          color={Kb.Styles.globalColors.redDark}
                        />
                      </Kb.WaitingButton>
                    )}
                  </Kb.Box2>
                )}
                {expanded && !!error && <Kb.Text type="BodySmallError">{error}</Kb.Text>}
              </Kb.Box2>
            </Kb.Box2>
            {!Kb.Styles.isPhone && (
              <Kb.Box2 direction="horizontal" alignSelf={expanded ? 'flex-start' : 'center'}>
                {rolePicker}
              </Kb.Box2>
            )}
          </Kb.Box2>
      </Kb.ClickableBox>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
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
  membershipTeamText: {justifyContent: 'center'},
  membershipTeamTextExpanded: Kb.Styles.platformStyles({
    isMobile: {paddingTop: Kb.Styles.globalMargins.tiny},
  }),
  paddingBottomMobile: Kb.Styles.platformStyles({
    isPhone: {paddingBottom: Kb.Styles.globalMargins.small},
  }),
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
  teamNameLink: {color: Kb.Styles.globalColors.black},
}))

export default TeamMember
