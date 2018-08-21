// @flow
import * as TeamsGen from '../../actions/teams-gen'
import * as SearchGen from '../../actions/search-gen'
import * as SearchConstants from '../../constants/search'
import {getRole, isOwner, teamWaitingKey} from '../../constants/teams'
import {upperFirst} from 'lodash-es'
import AddPeople from '.'
import {navigateAppend} from '../../actions/route-tree'
import {anyWaiting} from '../../constants/waiting'
import {
  connect,
  compose,
  lifecycle,
  withHandlers,
  withPropsOnChange,
  withStateHandlers,
  type TypedState,
} from '../../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  return {
    numberOfUsersSelected: SearchConstants.getUserInputItemIds(state, {searchKey: 'addToTeamSearch'}).length,
    name: teamname,
    _yourRole: getRole(state, teamname),
    errorText: upperFirst(state.teams.teamInviteError),
    loading: anyWaiting(state, teamWaitingKey(teamname)),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routePath, routeProps}) => ({
  _getSuggestions: () => dispatch(SearchGen.createSearchSuggestions({searchKey: 'addToTeamSearch'})),
  onAddPeople: (role: string, sendChatNotification: boolean) => {
    const teamname = routeProps.get('teamname')
    const rootPath = routePath.take(1)
    const sourceSubPath = routePath.rest()
    const destSubPath = sourceSubPath.butLast()
    dispatch(
      TeamsGen.createAddPeopleToTeam({
        destSubPath,
        role,
        rootPath,
        sendChatNotification,
        sourceSubPath,
        teamname,
      })
    )
  },
  onClearSearch: () => {
    dispatch(SearchGen.createClearSearchResults({searchKey: 'addToTeamSearch'}))
    dispatch(SearchGen.createSetUserInputItems({searchKey: 'addToTeamSearch', searchResults: []}))
    dispatch(TeamsGen.createSetTeamInviteError({error: ''}))
    dispatch(SearchGen.createSearchSuggestions({searchKey: 'addToTeamSearch'}))
  },
  onClose: () => {
    dispatch(navigateUp())
    dispatch(SearchGen.createClearSearchResults({searchKey: 'addToTeamSearch'}))
    dispatch(SearchGen.createSetUserInputItems({searchKey: 'addToTeamSearch', searchResults: []}))
    dispatch(TeamsGen.createSetTeamInviteError({error: ''}))
  },
  onBack: () => {
    dispatch(navigateUp())
    dispatch(SearchGen.createClearSearchResults({searchKey: 'addToTeamSearch'}))
    dispatch(SearchGen.createSetUserInputItems({searchKey: 'addToTeamSearch', searchResults: []}))
    dispatch(TeamsGen.createSetTeamInviteError({error: ''}))
  },
  onOpenRolePicker: (
    role: string,
    sendNotification: boolean,
    allowOwner: boolean,
    onComplete: (string, boolean) => void
  ) => {
    dispatch(
      navigateAppend([
        {
          props: {
            addButtonLabel: 'Add',
            allowOwner,
            headerTitle: 'Add them as:',
            onComplete,
            selectedRole: role,
            sendNotificationChecked: true,
            showNotificationCheckbox: false,
          },
          selected: 'controlledRolePicker',
        },
      ])
    )
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...s, ...d, ...o})),
  compose(
    withStateHandlers(
      {role: 'writer', sendNotification: true},
      {
        setSendNotification: () => sendNotification => ({sendNotification}),
        onRoleChange: () => role => ({role}),
      }
    ),
    withPropsOnChange(['onExitSearch', 'numberOfUsersSelected'], props => ({
      addButtonLabel: props.numberOfUsersSelected > 0 ? `Add (${props.numberOfUsersSelected})` : 'Add',
      onCancel: () => props.onClose(),
      title: `Add to ${props.name}`,
    })),
    lifecycle({
      componentDidMount() {
        this.props._getSuggestions()
      },
    }),
    withHandlers({
      onAddPeople: ({onAddPeople, role, sendNotification}) => () =>
        role && onAddPeople(role, sendNotification),
      onOpenRolePicker: ({
        onAddPeople,
        onOpenRolePicker,
        role,
        onRoleChange,
        sendNotification,
        setSendNotification,
        _yourRole,
      }) => () => {
        onOpenRolePicker(role, sendNotification, isOwner(_yourRole), (role, sendNotification) => {
          onRoleChange(role)
          setSendNotification(sendNotification)
          onAddPeople(role, sendNotification)
        })
      },
    })
  )
)(AddPeople)
