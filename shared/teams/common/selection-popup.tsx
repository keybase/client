import * as C from '../../constants'
import type * as T from '../../constants/types'
import * as ChatConstants from '../../constants/chat2'
import * as Constants from '../../constants/teams'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import {FloatingRolePicker} from '../role-picker'
import {pluralize} from '../../util/string'
import {useFocusEffect} from '@react-navigation/core'

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

const getChannelSelectedCount = (props: ChannelProps) => {
  const {conversationIDKey, selectedTab} = props
  switch (selectedTab) {
    default:
      return C.useTeamsState.getState().channelSelectedMembers.get(conversationIDKey)?.size ?? 0
  }
}

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
  useFocusEffect(
    React.useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, [setFocused])
  )

  // For boosting the list to scroll not behind the popup on mobile
  const [height, setHeight] = React.useState(0)
  const {bottom} = Kb.useSafeAreaInsets()
  if (!onSelectableTab || (Styles.isMobile && !selectedCount) || !focused) {
    return null
  }
  const popup = (
    <Kb.Box2
      fullWidth={Styles.isMobile}
      direction={Styles.isPhone ? 'vertical' : 'horizontal'}
      alignItems="center"
      style={Styles.collapseStyles([
        styles.container,
        selectedCount && !Styles.isMobile ? styles.containerShowing : null,
      ])}
      gap={Styles.isPhone ? 'tiny' : undefined}
      className="selectionPopup"
      onLayout={Styles.isMobile ? event => setHeight(event.nativeEvent.layout.height) : undefined}
    >
      {Styles.isPhone && (
        <Kb.Text style={styles.topLink} type="BodyBigLink" onClick={onCancel}>
          Cancel
        </Kb.Text>
      )}
      <Kb.Text type="BodySmall">
        {selectedCount} {pluralize(selectableTabName, selectedCount)} selected.{' '}
        {!Styles.isPhone && (
          <Kb.Text type="BodySmallPrimaryLink" onClick={onCancel}>
            Unselect
          </Kb.Text>
        )}
      </Kb.Text>

      {!Styles.isPhone && <Kb.BoxGrow />}
      {children}
      {/* bottom safe area */}
      {Styles.isPhone && <Kb.Box style={{height: bottom}} />}
    </Kb.Box2>
  )
  return Styles.isMobile ? (
    <>
      {<Kb.Box style={{height: height > 48 ? height - 48 - bottom : -bottom}} />}
      <Kb.FloatingBox>{popup}</Kb.FloatingBox>
    </>
  ) : (
    popup
  )
}

const TeamSelectionPopup = (props: TeamProps) => {
  const {selectedTab, teamID} = props

  const selectedCount = C.useTeamsState(s =>
    selectedTab === 'teamChannels'
      ? s.teamSelectedChannels.get(teamID)?.size ?? 0
      : s.teamSelectedMembers.get(teamID)?.size ?? 0
  )

  const setChannelSelected = C.useTeamsState(s => s.dispatch.setChannelSelected)
  const setMemberSelected = C.useTeamsState(s => s.dispatch.setMemberSelected)

  const onCancel = () => {
    switch (selectedTab) {
      case 'teamChannels':
        setChannelSelected(teamID, '', false, true)
        return
      case 'teamMembers':
        setMemberSelected(teamID, '', false, true)
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
  const selectedCount = getChannelSelectedCount(props)
  const channelSetMemberSelected = C.useTeamsState(s => s.dispatch.channelSetMemberSelected)
  const onCancel = () => {
    switch (selectedTab) {
      case 'channelMembers':
        channelSetMemberSelected(conversationIDKey, '', false, true)
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
  <Kb.Box2 fullWidth={Styles.isPhone} direction={Styles.isPhone ? 'vertical' : 'horizontal'} gap="tiny">
    {children}
  </Kb.Box2>
)
const TeamMembersActions = ({teamID}: TeamActionsProps) => {
  const membersSet = C.useTeamsState(s => s.teamSelectedMembers.get(teamID))
  const isBigTeam = C.useChatState(s => ChatConstants.isBigTeam(s, teamID))
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  if (!membersSet) {
    // we shouldn't be rendered
    return null
  }
  const members = [...membersSet]

  // Members tab functions
  const onAddToChannel = () =>
    navigateAppend({props: {teamID, usernames: members}, selected: 'teamAddToChannels'})
  const onRemoveFromTeam = () =>
    navigateAppend({props: {members: members, teamID}, selected: 'teamReallyRemoveMember'})

  return (
    <ActionsWrapper>
      {isBigTeam && (
        <Kb.Button
          label="Add to channels"
          mode="Secondary"
          onClick={onAddToChannel}
          fullWidth={Styles.isPhone}
        />
      )}
      <EditRoleButton teamID={teamID} members={members} />
      <Kb.Button
        label="Remove from team"
        type="Danger"
        onClick={onRemoveFromTeam}
        fullWidth={Styles.isPhone}
      />
    </ActionsWrapper>
  )
}

const emptySetForUseSelector = new Set<string>()
function allSameOrNull<T>(arr: T[]): T | null {
  if (arr.length === 0) {
    return null
  }
  const first = arr[0]
  return (arr.some(r => r !== first) ? null : first) ?? null
}
const EditRoleButton = ({members, teamID}: {teamID: T.Teams.TeamID; members: string[]}) => {
  const teamDetails = C.useTeamsState(s => s.teamDetails.get(teamID))
  const roles = members.map(username => teamDetails?.members.get(username)?.type)
  const currentRole = allSameOrNull(roles) ?? undefined

  const [showingPicker, setShowingPicker] = React.useState(false)

  const waiting = Container.useAnyWaiting(Constants.editMembershipWaitingKey(teamID, ...members))
  const teamWaiting = Container.useAnyWaiting(Constants.teamWaitingKey(teamID))

  // We wait for the teamLoaded
  React.useEffect(() => {
    if (showingPicker && !teamWaiting) {
      setShowingPicker(false)
    }
  }, [showingPicker, teamWaiting])

  const disabledReasons = C.useTeamsState(s => Constants.getDisabledReasonsForRolePicker(s, teamID, members))
  const disableButton = disabledReasons.admin !== undefined
  const editMembership = C.useTeamsState(s => s.dispatch.editMembership)
  const onChangeRoles = (role: T.Teams.TeamRoleType) => editMembership(teamID, members, role)

  return (
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
        fullWidth={Styles.isPhone}
        tooltip={disableButton ? disabledReasons.admin : undefined}
      />
    </FloatingRolePicker>
  )
}

const TeamChannelsActions = ({teamID}: TeamActionsProps) => {
  // Channels tab functions
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onDelete = () => navigateAppend({props: {teamID}, selected: 'teamDeleteChannel'})

  return (
    <ActionsWrapper>
      <Kb.Button label="Delete" type="Danger" onClick={onDelete} fullWidth={Styles.isMobile} />
    </ActionsWrapper>
  )
}
const ChannelMembersActions = ({conversationIDKey, teamID}: ChannelActionsProps) => {
  const membersSet = C.useTeamsState(
    s => s.channelSelectedMembers.get(conversationIDKey) ?? emptySetForUseSelector
  )
  const channelInfo = C.useTeamsState(s => Constants.getTeamChannelInfo(s, teamID, conversationIDKey))
  const {channelname} = channelInfo
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

  if (!membersSet) {
    // we shouldn't be rendered
    return null
  }
  const members = [...membersSet]

  // Members tab functions
  const onAddToChannel = () =>
    navigateAppend({props: {teamID, usernames: members}, selected: 'teamAddToChannels'})
  const onRemoveFromChannel = () =>
    navigateAppend({
      props: {conversationIDKey, members: [...members], teamID},
      selected: 'teamReallyRemoveChannelMember',
    })

  return (
    <ActionsWrapper>
      <Kb.Button
        label="Add to channels"
        mode="Secondary"
        onClick={onAddToChannel}
        fullWidth={Styles.isPhone}
      />
      <EditRoleButton teamID={teamID} members={members} />
      {channelname !== 'general' && (
        <Kb.Button
          label="Remove from channel"
          type="Danger"
          onClick={onRemoveFromChannel}
          fullWidth={Styles.isPhone}
        />
      )}
    </ActionsWrapper>
  )
}

const teamActionsComponent: {[k in TeamSelectableTab]: React.ComponentType<TeamActionsProps>} = {
  teamChannels: TeamChannelsActions,
  teamMembers: TeamMembersActions,
}

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      position: 'absolute',
    },
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      ...Styles.padding(6, Styles.globalMargins.xsmall),
      borderRadius: 4,
      bottom: -48,
      left: Styles.globalMargins.tiny,
      right: Styles.globalMargins.tiny,
    },
    isMobile: {
      ...Styles.padding(Styles.globalMargins.small),
      bottom: 0,
      shadowOffset: {height: 2, width: 0},
      shadowOpacity: 0.8,
      shadowRadius: 5,
    },
  }),
  containerShowing: {
    bottom: Styles.globalMargins.small,
  },
  topLink: {
    alignSelf: 'flex-start',
    paddingBottom: Styles.globalMargins.tiny,
  },
}))

export default SelectionPopup
