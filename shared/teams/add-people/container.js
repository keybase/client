// @flow
import * as TeamsGen from '../../actions/teams-gen'
import * as SearchGen from '../../actions/search-gen'
import * as SearchConstants from '../../constants/search'
import {getRole, isOwner, teamWaitingKey} from '../../constants/teams'
import {upperFirst} from 'lodash-es'
import AddPeople from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {anyWaiting} from '../../constants/waiting'
import {
  connect,
  compose,
  lifecycle,
  withHandlers,
  withPropsOnChange,
  withStateHandlers,
  type RouteProps,
} from '../../util/container'

type OwnProps = RouteProps<{teamname: string}, {}>

const mapStateToProps = (state, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  return {
    _yourRole: getRole(state, teamname),
    errorText: upperFirst(state.teams.teamInviteError),
    loading: anyWaiting(state, teamWaitingKey(teamname)),
    name: teamname,
    numberOfUsersSelected: SearchConstants.getUserInputItemIds(state, 'addToTeamSearch').size,
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routePath, routeProps}) => ({
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
  onBack: () => {
    dispatch(navigateUp())
    dispatch(SearchGen.createClearSearchResults({searchKey: 'addToTeamSearch'}))
    dispatch(SearchGen.createSetUserInputItems({searchKey: 'addToTeamSearch', searchResults: []}))
    dispatch(TeamsGen.createSetTeamInviteError({error: ''}))
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
  onOpenRolePicker: (
    role: string,
    sendNotification: boolean,
    allowOwner: boolean,
    onComplete: (string, boolean) => void
  ) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [
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
      ]})
    )
  },
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  compose(
    withStateHandlers(
      {role: 'writer', sendNotification: true},
      {
        onRoleChange: () => role => ({role}),
        setSendNotification: () => sendNotification => ({sendNotification}),
      }
    ),
    withPropsOnChange(['numberOfUsersSelected'], props => ({
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
