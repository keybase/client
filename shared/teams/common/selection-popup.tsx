import * as C from '@/constants'
import {isBigTeam as getIsBigTeam} from '@/constants/chat/helpers'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {useCurrentUserState} from '@/stores/current-user'
import {FloatingRolePicker} from '../role-picker'
import {getRolePickerDisabledReasons} from '../role-picker-utils'
import {useLoadedTeamChannels} from './use-loaded-team-channels'
import {useChannelSelectionState, useTeamSelectionState} from './selection-state'
import {useLoadedTeam} from '../team/use-loaded-team'
import {pluralize} from '@/util/string'

type UnselectableTab = string
type TeamSelectableTab = 'teamMembers' | 'teamChannels'
type ChannelSelectableTab = 'channelMembers'

type TeamActionsProps = {
  teamID: T.Teams.TeamID
}
type TeamProps = TeamActionsProps & {
  selectedTab: TeamSelectableTab
}

type ChannelActionsProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  teamID: T.Teams.TeamID
}
type ChannelProps = ChannelActionsProps & {
  selectedTab: ChannelSelectableTab
}

type UnselectableProps = {
  selectedTab: UnselectableTab
} & Partial<TeamActionsProps> &
  Partial<ChannelActionsProps>

type Props = TeamProps | ChannelProps | UnselectableProps

const isChannel = (props: Props): props is ChannelProps => ['channelMembers'].includes(props.selectedTab)
const isTeam = (props: Props): props is TeamProps =>
  ['teamChannels', 'teamMembers'].includes(props.selectedTab)

// In order for Selection Popup to show in a tab
// the respective tab needs to be added to this map
const teamSelectableTabNames: {[k in TeamSelectableTab]: string} = {
  teamChannels: 'channel',
  teamMembers: 'member',
}
const channelSelectableTabNames: {[k in ChannelSelectableTab]: string} = {
  channelMembers: 'member',
}

type JointSelectionPopupProps = {
  children: React.ReactNode
  onCancel: () => void
  selectableTabName: string
  selectedCount: number
}

const JointSelectionPopup = (props: JointSelectionPopupProps) => {
  const {onCancel, selectableTabName, selectedCount, children} = props
  const onSelectableTab = !!selectableTabName

  // This is a bit of a hack to work around the floating box displaying above modals on mobile.
  // Probably it's not worth thinking about the root problem until we're on nav 5.
  const [focused, setFocused] = React.useState(true)
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, [])
  )

  // For boosting the list to scroll not behind the popup on mobile
  const [height, setHeight] = React.useState(0)
  const {bottom} = Kb.useSafeAreaInsets()
  if (!onSelectableTab || !selectedCount || !focused) {
    return null
  }
  const popup = (
    <Kb.Box2
      fullWidth={Kb.Styles.isMobile}
      direction={Kb.Styles.isPhone ? 'vertical' : 'horizontal'}
      alignItems="center"
      style={Kb.Styles.collapseStyles([
        styles.container,
        selectedCount && !Kb.Styles.isMobile ? styles.containerShowing : null,
      ])}
      {...(Kb.Styles.isPhone ? {gap: 'tiny' as const} : {})}
      className="selectionPopup"
      {...(Kb.Styles.isMobile
        ? {onLayout: (event: Kb.LayoutEvent) => setHeight(event.nativeEvent.layout.height)}
        : {})}
    >
      {Kb.Styles.isPhone && (
        <Kb.Text style={styles.topLink} type="BodyBigLink" onClick={onCancel}>
          Cancel
        </Kb.Text>
      )}
      <Kb.Text type="BodySmall">
        {selectedCount} {pluralize(selectableTabName, selectedCount)} selected.{' '}
        {!Kb.Styles.isPhone && (
          <Kb.Text type="BodySmallPrimaryLink" onClick={onCancel}>
            Unselect
          </Kb.Text>
        )}
      </Kb.Text>

      {!Kb.Styles.isPhone && <Kb.BoxGrow />}
      {children}
      {/* bottom safe area */}
      {Kb.Styles.isPhone && <Kb.Box2 direction="vertical" style={{height: bottom}} />}
    </Kb.Box2>
  )
  return Kb.Styles.isMobile ? (
    <>
      {<Kb.Box2 direction="vertical" style={{height: height > 48 ? height - 48 - bottom : -bottom}} />}
      <Kb.Popup>{popup}</Kb.Popup>
    </>
  ) : (
    popup
  )
}

const TeamSelectionPopup = (props: TeamProps) => {
  const {selectedTab, teamID} = props
  const {clearSelectedChannels, clearSelectedMembers, selectedChannels, selectedMembers} =
    useTeamSelectionState()
  const selectedCount = selectedTab === 'teamChannels' ? selectedChannels.size : selectedMembers.size

  const onCancel = () => {
    switch (selectedTab) {
      case 'teamChannels':
        clearSelectedChannels()
        return
      case 'teamMembers':
        clearSelectedMembers()
        return
    }
  }

  const selectableTabName = teamSelectableTabNames[selectedTab]
  const Actions = teamActionsComponent[selectedTab]
  return (
    <JointSelectionPopup
      selectableTabName={selectableTabName}
      selectedCount={selectedCount}
      onCancel={onCancel}
    >
      <Actions teamID={teamID} />
    </JointSelectionPopup>
  )
}

const ChannelSelectionPopup = (props: ChannelProps) => {
  const {conversationIDKey, selectedTab, teamID} = props
  const {clearSelectedMembers, selectedMembers} = useChannelSelectionState()
  const selectedCount = selectedMembers.size
  const onCancel = () => {
    switch (selectedTab) {
      // eslint-disable-next-line
      case 'channelMembers':
        clearSelectedMembers()
        return
    }
  }

  const selectableTabName = channelSelectableTabNames[selectedTab]

  return (
    <JointSelectionPopup
      selectableTabName={selectableTabName}
      selectedCount={selectedCount}
      onCancel={onCancel}
    >
      <ChannelMembersActions conversationIDKey={conversationIDKey} teamID={teamID} />
    </JointSelectionPopup>
  )
}

const SelectionPopup = (props: Props) =>
  isChannel(props) ? (
    <ChannelSelectionPopup {...props} />
  ) : isTeam(props) ? (
    <TeamSelectionPopup {...props} />
  ) : null

const ActionsWrapper = ({children}: {children: React.ReactNode}) => (
  <Kb.Box2 fullWidth={Kb.Styles.isPhone} direction={Kb.Styles.isPhone ? 'vertical' : 'horizontal'} gap="tiny">
    {children}
  </Kb.Box2>
)
const TeamMembersActions = ({teamID}: TeamActionsProps) => {
  const {selectedMembers} = useTeamSelectionState()
  const isBigTeam = Chat.useChatState(s => getIsBigTeam(s.inboxLayout, teamID))
  const navigateAppend = C.Router2.navigateAppend
  if (!selectedMembers.size) {
    // we shouldn't be rendered
    return null
  }
  const members = [...selectedMembers]

  // Members tab functions
  const onAddToChannel = () =>
    navigateAppend({name: 'teamAddToChannels', params: {teamID, usernames: members}})
  const onRemoveFromTeam = () =>
    navigateAppend({name: 'teamReallyRemoveMember', params: {members: members, teamID}})

  return (
    <ActionsWrapper>
      {isBigTeam && (
        <Kb.Button
          label="Add to channels"
          mode="Secondary"
          onClick={onAddToChannel}
          fullWidth={Kb.Styles.isPhone}
        />
      )}
      <EditRoleButton teamID={teamID} members={members} />
      <Kb.Button
        label="Remove from team"
        type="Danger"
        onClick={onRemoveFromTeam}
        fullWidth={Kb.Styles.isPhone}
      />
    </ActionsWrapper>
  )
}

function allSameOrNull<T>(arr: T[]): T | null {
  if (arr.length === 0) {
    return null
  }
  const first = arr[0]
  return (arr.some(r => r !== first) ? null : first) ?? null
}
const EditRoleButton = ({members, teamID}: {teamID: T.Teams.TeamID; members: string[]}) => {
  const currentUsername = useCurrentUserState(s => s.username)
  const {
    teamDetails: {members: teamMembers},
    teamMeta: {teamname},
    yourOperations,
  } = useLoadedTeam(teamID)
  const disabledReasons = getRolePickerDisabledReasons({
    canManageMembers: yourOperations.manageMembers,
    currentUsername,
    members: teamMembers,
    membersToModify: members,
    teamname,
  })
  const roles = members.map(username => teamMembers.get(username)?.type)
  const currentRole = allSameOrNull(roles) ?? undefined

  const [showingPicker, setShowingPicker] = React.useState(false)
  const [error, setError] = React.useState('')
  const editMembership = C.useRPC(T.RPCGen.teamsTeamEditMembersRpcPromise)

  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsEditMembership(teamID, ...members))
  const teamWaiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsTeam(teamID))
  const prevTeamWaitingRef = React.useRef(teamWaiting)

  // We wait for the teamLoaded (close only when teamWaiting transitions true -> false after an edit)
  React.useEffect(() => {
    if (showingPicker && prevTeamWaitingRef.current && !teamWaiting) {
      setShowingPicker(false)
    }
    prevTeamWaitingRef.current = teamWaiting
  }, [showingPicker, teamWaiting])

  const disableButton = disabledReasons.admin !== undefined
  const onChangeRoles = (role: T.Teams.TeamRoleType) => {
    setError('')
    editMembership(
      [
        {
          teamID,
          users: members.map(assertion => ({assertion, role: T.RPCGen.TeamRole[role]})),
        },
        [C.waitingKeyTeamsTeam(teamID), C.waitingKeyTeamsEditMembership(teamID, ...members)],
      ],
      () => {},
      err => {
        setError(err.message)
      }
    )
  }

  return (
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={Kb.Styles.isPhone}>
      <FloatingRolePicker
        presetRole={currentRole}
        onConfirm={onChangeRoles}
        onCancel={() => setShowingPicker(false)}
        position="top center"
        open={showingPicker}
        disabledRoles={disabledReasons}
        // TODO waiting should actually understand we submitted but haven't seen teamLoaded yet, but that requires more plumbing
        waiting={waiting}
      >
        <Kb.Button
          label="Edit role"
          mode="Secondary"
          disabled={disableButton}
          onClick={() => setShowingPicker(!showingPicker)}
          fullWidth={Kb.Styles.isPhone}
          {...(disabledReasons.admin === undefined ? {} : {tooltip: disabledReasons.admin})}
        />
      </FloatingRolePicker>
      {!!error && <Kb.Text type="BodySmallError">{error}</Kb.Text>}
    </Kb.Box2>
  )
}

const TeamChannelsActions = ({teamID}: TeamActionsProps) => {
  const {selectedChannels} = useTeamSelectionState()
  // Channels tab functions
  const navigateAppend = C.Router2.navigateAppend
  const onDelete = () =>
    navigateAppend({
      name: 'teamDeleteChannel',
      params: {conversationIDKeys: [...selectedChannels], teamID},
    })

  return (
    <ActionsWrapper>
      <Kb.Button label="Delete" type="Danger" onClick={onDelete} fullWidth={Kb.Styles.isMobile} />
    </ActionsWrapper>
  )
}
const ChannelMembersActions = ({conversationIDKey, teamID}: ChannelActionsProps) => {
  const {channels} = useLoadedTeamChannels(teamID)
  const channelInfo = channels.get(conversationIDKey)
  const {selectedMembers} = useChannelSelectionState()
  const channelname = channelInfo?.channelname ?? ''
  const navigateAppend = C.Router2.navigateAppend

  if (!selectedMembers.size) {
    // we shouldn't be rendered
    return null
  }
  const members = [...selectedMembers]

  // Members tab functions
  const onAddToChannel = () =>
    navigateAppend({name: 'teamAddToChannels', params: {teamID, usernames: members}})
  const onRemoveFromChannel = () =>
    navigateAppend({
      name: 'teamReallyRemoveChannelMember',
      params: {conversationIDKey, members: [...members], teamID},
    })

  return (
    <ActionsWrapper>
      <Kb.Button
        label="Add to channels"
        mode="Secondary"
        onClick={onAddToChannel}
        fullWidth={Kb.Styles.isPhone}
      />
      <EditRoleButton teamID={teamID} members={members} />
      {!!channelInfo && channelname !== 'general' && (
        <Kb.Button
          label="Remove from channel"
          type="Danger"
          onClick={onRemoveFromChannel}
          fullWidth={Kb.Styles.isPhone}
        />
      )}
    </ActionsWrapper>
  )
}

const teamActionsComponent: {[k in TeamSelectableTab]: React.ComponentType<TeamActionsProps>} = {
  teamChannels: TeamChannelsActions,
  teamMembers: TeamMembersActions,
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.white,
      position: 'absolute',
    },
    isElectron: {
      ...Kb.Styles.desktopStyles.boxShadow,
      ...Kb.Styles.padding(6, Kb.Styles.globalMargins.xsmall),
      borderRadius: 4,
      bottom: -48,
      left: Kb.Styles.globalMargins.tiny,
      right: Kb.Styles.globalMargins.tiny,
    },
    isMobile: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      bottom: 0,
      shadowOffset: {height: 2, width: 0},
      shadowOpacity: 0.8,
      shadowRadius: 5,
    },
  }),
  containerShowing: {
    bottom: Kb.Styles.globalMargins.small,
  },
  topLink: {
    alignSelf: 'flex-start',
    paddingBottom: Kb.Styles.globalMargins.tiny,
  },
}))

export default SelectionPopup
