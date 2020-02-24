import * as React from 'react'
import * as Types from '../../constants/types/teams'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as TeamsGen from '../../actions/teams-gen'
import {pluralize} from '../../util/string'

type Props = {
  selectedTab: Types.TabKey
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
const tabThings = {
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

  // Chanels tab functions
  const onDelete = () => {}

  // Members tab functions
  const onAddToChannel = () => {}
  const onEditRoles = () => {}
  const onRemoveFromTeam = () => {}

  const tabThing = tabThings[props.selectedTab]
  const onSelectableTab = !!tabThing

  if (!onSelectableTab || (Styles.isMobile && !selectedCount)) {
    return null
  }
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
      {props.selectedTab == 'channels' && (
        <Kb.Button label="Delete" type="Danger" onClick={onDelete} fullWidth={Styles.isMobile} />
      )}

      {props.selectedTab == 'members' && (
        <Kb.Box2
          fullWidth={Styles.isMobile}
          direction={Styles.isMobile ? 'vertical' : 'horizontal'}
          gap="tiny"
        >
          <Kb.Button
            label="Add to channels"
            mode="Secondary"
            onClick={onAddToChannel}
            fullWidth={Styles.isMobile}
          />
          <Kb.Button label="Edit role" mode="Secondary" onClick={onEditRoles} fullWidth={Styles.isMobile} />
          <Kb.Button
            label="Remove from team"
            type="Danger"
            onClick={onRemoveFromTeam}
            fullWidth={Styles.isMobile}
          />
        </Kb.Box2>
      )}
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

export default SelectionPopup

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
