import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as ChatTypes from '../../constants/types/chat2'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {pluralize} from '../../util/string'
import {FloatingRolePicker} from '../role-picker'

type UnselectableTab = string
type TeamSelectableTab = 'teamMembers' | 'teamChannels'
type ChannelSelectableTab = 'channelMembers'

type TeamActionsProps = {
  teamID: Types.TeamID
}
type TeamProps = TeamActionsProps & {
  selectedTab: TeamSelectableTab
}

type ChannelActionsProps = {
  conversationIDKey: ChatTypes.ConversationIDKey
  teamID: Types.TeamID
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

const getTeamSelectedCount = (state: Container.TypedState, props: TeamProps) => {
  const {selectedTab, teamID} = props
  switch (selectedTab) {
    case 'teamChannels':
      return state.teams.teamSelectedChannels.get(teamID)?.size ?? 0
    case 'teamMembers':
      return state.teams.teamSelectedMembers.get(teamID)?.size ?? 0
  }
}

const getChannelSelectedCount = (state: Container.TypedState, props: ChannelProps) => {
  const {conversationIDKey, selectedTab} = props
  switch (selectedTab) {
    case 'channelMembers':
      return state.teams.channelSelectedMembers.get(conversationIDKey)?.size ?? 0
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
  Container.useFocusBlur(
    () => setFocused(true),
    () => setFocused(false)
  )

  // For boosting the list to scroll not behind the popup on mobile
  const [height, setHeight] = React.useState(0)
  if (!onSelectableTab || (Styles.isMobile && !selectedCount) || !focused) {
    return null
  }
  const {bottom} = Kb.useSafeArea()
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
  const selectedCount = Container.useSelector(state => getTeamSelectedCount(state, props))
  const dispatch = Container.useDispatch()

  const onCancel = () => {
    switch (selectedTab) {
      case 'teamChannels':
        dispatch(
          TeamsGen.createSetChannelSelected({
            channel: '',
            clearAll: true,
            selected: false,
            teamID: teamID,
          })
        )
        return
      case 'teamMembers':
        dispatch(
          TeamsGen.createTeamSetMemberSelected({
            clearAll: true,
            selected: false,
            teamID: teamID,
            username: '',
          })
        )
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
  const selectedCount = Container.useSelector(state => getChannelSelectedCount(state, props))
  const dispatch = Container.useDispatch()

  const onCancel = () => {
    switch (selectedTab) {
      case 'channelMembers':
        dispatch(
          TeamsGen.createChannelSetMemberSelected({
            clearAll: true,
            conversationIDKey,
            selected: false,
            username: '',
          })
        )
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

const ActionsWrapper = ({children}) => (
  <Kb.Box2 fullWidth={Styles.isPhone} direction={Styles.isPhone ? 'vertical' : 'horizontal'} gap="tiny">
    {children}
  </Kb.Box2>
)
const TeamMembersActions = ({teamID}: TeamActionsProps) => {
  const dispatch = Container.useDispatch()
  const membersSet = Container.useSelector(s => s.teams.teamSelectedMembers.get(teamID))
  const isBigTeam = Container.useSelector(s => Constants.isBigTeam(s, teamID))
  if (!membersSet) {
    // we shouldn't be rendered
    return null
  }
  const members = [...membersSet]

  // Members tab functions
  const onAddToChannel = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamID, usernames: members}, selected: 'teamAddToChannels'}],
      })
    )
  const onRemoveFromTeam = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {members: members, teamID}, selected: 'teamReallyRemoveMember'}],
      })
    )

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
  return arr.some(r => r !== first) ? null : first
}
const EditRoleButton = ({members, teamID}: {teamID: Types.TeamID; members: string[]}) => {
  const dispatch = Container.useDispatch()

  const teamDetails = Container.useSelector(state => Constants.getTeamDetails(state, teamID))
  const roles = members.map(username => teamDetails.members.get(username)?.type)
  const currentRole = allSameOrNull(roles)

  const [showingPicker, _setShowingPicker] = React.useState(false)
  const setShowingPicker = (show: boolean) => {
    _setShowingPicker(show)
  }

  const waiting = Container.useAnyWaiting(Constants.editMembershipWaitingKey(teamID, ...members))
  const wasWaiting = Container.usePrevious(waiting)
  React.useEffect(() => {
    wasWaiting && !waiting && showingPicker && _setShowingPicker(false)
  }, [waiting, wasWaiting, showingPicker, _setShowingPicker])

  const disabledReasons = Container.useSelector(state =>
    Constants.getDisabledReasonsForRolePicker(state, teamID, members)
  )
  const disableButton = disabledReasons.admin !== undefined
  const onChangeRoles = (role: Types.TeamRoleType) =>
    dispatch(TeamsGen.createEditMembership({role, teamID, usernames: members}))

  return (
    <FloatingRolePicker
      presetRole={currentRole}
      onConfirm={onChangeRoles}
      onCancel={() => setShowingPicker(false)}
      position="top center"
      open={showingPicker}
      disabledRoles={disabledReasons}
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
  const dispatch = Container.useDispatch()

  // Channels tab functions
  const onDelete = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamID}, selected: 'teamDeleteChannel'}],
      })
    )

  return (
    <ActionsWrapper>
      <Kb.Button label="Delete" type="Danger" onClick={onDelete} fullWidth={Styles.isMobile} />
    </ActionsWrapper>
  )
}
const ChannelMembersActions = ({conversationIDKey, teamID}: ChannelActionsProps) => {
  const dispatch = Container.useDispatch()
  const membersSet = Container.useSelector(
    s => s.teams.channelSelectedMembers.get(conversationIDKey) ?? emptySetForUseSelector
  )
  const channelInfo = Container.useSelector(s => Constants.getTeamChannelInfo(s, teamID, conversationIDKey))
  const {channelname} = channelInfo

  if (!membersSet) {
    // we shouldn't be rendered
    return null
  }
  const members = [...membersSet]

  // Members tab functions
  const onAddToChannel = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamID, usernames: members}, selected: 'teamAddToChannels'}],
      })
    )
  const onRemoveFromChannel = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey, members: [...members], teamID},
            selected: 'teamReallyRemoveChannelMember',
          },
        ],
      })
    )

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
