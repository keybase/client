import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as TeamsGen from '../../actions/teams-gen'
import {pluralize} from '../../util/string'

type SelectableTab = Extract<Types.TabKey, 'members' | 'channels'>

type Props = {
  selectedTab: SelectableTab
  teamID: Types.TeamID
}

const getSelectedCount = (state: Container.TypedState, props: Props) => {
  switch (props.selectedTab) {
    case 'channels':
      return state.teams.selectedChannels.get(props.teamID)?.size ?? 0
    case 'members':
      return state.teams.selectedMembers.get(props.teamID)?.size ?? 0
    default:
      return 0
  }
}

// In order for Selection Popup to show in a tab
// the respective tab needs to be added to this map
const tabThings: {[k in SelectableTab]: string} = {
  channels: 'channel',
  members: 'member',
}

// How much to bump the list height by when the selection popup is present on mobile
const heightsMap = {
  channels: {height: 70},
  members: {height: 180},
}

const SelectionPopup = (props: Props) => {
  const selectedCount = Container.useSelector(state => getSelectedCount(state, props))
  const dispatch = Container.useDispatch()

  const onUnselect = () => {
    switch (props.selectedTab) {
      case 'channels':
        dispatch(
          TeamsGen.createSetChannelSelected({
            channel: '',
            clearAll: true,
            selected: false,
            teamID: props.teamID,
          })
        )
        return
      case 'members':
        dispatch(
          TeamsGen.createSetMemberSelected({
            clearAll: true,
            selected: false,
            teamID: props.teamID,
            username: '',
          })
        )
        return
    }
  }

  const tabThing = tabThings[props.selectedTab]
  const onSelectableTab = !!tabThing

  if (!onSelectableTab || (Styles.isMobile && !selectedCount)) {
    return null
  }
  const Actions = actionsComponent[props.selectedTab]
  const popup = (
    <Kb.Box2
      fullWidth={Styles.isMobile}
      direction={Styles.isMobile ? 'vertical' : 'horizontal'}
      alignItems="center"
      style={Styles.collapseStyles([
        styles.container,
        selectedCount && !Styles.isMobile ? styles.containerShowing : null,
      ])}
      gap={Styles.isMobile ? 'tiny' : undefined}
      className="selectionPopup"
    >
      {Styles.isMobile && (
        <Kb.Text style={styles.topLink} type="BodyPrimaryLink" onClick={onUnselect}>
          Cancel
        </Kb.Text>
      )}
      <Kb.Text type="BodySmall">
        {selectedCount} {pluralize(tabThing, selectedCount)} selected.{' '}
        {!Styles.isMobile && (
          <Kb.Text type="BodySmallPrimaryLink" onClick={onUnselect}>
            Unselect
          </Kb.Text>
        )}
      </Kb.Text>

      {!Styles.isMobile && <Kb.BoxGrow />}

      <Actions teamID={props.teamID} />
    </Kb.Box2>
  )
  return Styles.isMobile ? (
    <>
      <Kb.Box style={heightsMap[props.selectedTab]} />
      <Kb.FloatingBox>{popup}</Kb.FloatingBox>
    </>
  ) : (
    popup
  )
}

type ActionsProps = {teamID: Types.TeamID}
const ActionsWrapper = ({children}) => (
  <Kb.Box2 fullWidth={Styles.isMobile} direction={Styles.isMobile ? 'vertical' : 'horizontal'} gap="tiny">
    {children}
  </Kb.Box2>
)
const MembersActions = ({teamID}: ActionsProps) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const members = Container.useSelector(s => s.teams.selectedMembers.get(teamID))
  const isBigTeam = Container.useSelector(s => Constants.isBigTeam(s, teamID))
  if (!members) {
    // we shouldn't be rendered
    return null
  }

  // Members tab functions
  const onAddToChannel = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [{props: {teamID, usernames: [...members]}, selected: 'teamAddToChannels'}],
      })
    )
  const onEditRoles = () => {}
  const onRemoveFromTeam = () => {}

  return (
    <ActionsWrapper>
      {isBigTeam && (
        <Kb.Button
          label="Add to channels"
          mode="Secondary"
          onClick={onAddToChannel}
          fullWidth={Styles.isMobile}
        />
      )}
      <Kb.Button label="Edit role" mode="Secondary" onClick={onEditRoles} fullWidth={Styles.isMobile} />
      <Kb.Button
        label="Remove from team"
        type="Danger"
        onClick={onRemoveFromTeam}
        fullWidth={Styles.isMobile}
      />
    </ActionsWrapper>
  )
}

const ChannelsActions = (_: ActionsProps) => {
  // Channels tab functions
  const onDelete = () => {}
  return (
    <ActionsWrapper>
      <Kb.Button label="Delete" type="Danger" onClick={onDelete} fullWidth={Styles.isMobile} />
    </ActionsWrapper>
  )
}

const actionsComponent: {[k in SelectableTab]: React.ComponentType<ActionsProps>} = {
  channels: ChannelsActions,
  members: MembersActions,
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
