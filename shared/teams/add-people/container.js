// @flow
import * as TeamsGen from '../../actions/teams-gen'
import * as SearchGen from '../../actions/search-gen'
import * as SearchConstants from '../../constants/search'
import {getRole, isOwner} from '../../constants/teams'
import {upperFirst} from 'lodash-es'
import AddPeople from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import flags from '../../util/feature-flags'

type OwnProps = Container.RouteProps<{teamname: string}, {}>

const mapStateToProps = (state, ownProps) => {
  const teamname = Container.getRouteProps(ownProps, 'teamname')
  return {
    _yourRole: getRole(state, teamname),
    errorText: upperFirst(state.teams.teamInviteError),
    name: teamname,
    numberOfUsersSelected: SearchConstants.getUserInputItemIds(state, 'addToTeamSearch').size,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _getSuggestions: () => dispatch(SearchGen.createSearchSuggestions({searchKey: 'addToTeamSearch'})),
  onAddPeople: (role: string, sendChatNotification: boolean) => {
    const teamname = Container.getRouteProps(ownProps, 'teamname')
    if (flags.useNewRouter) {
      dispatch(TeamsGen.createAddPeopleToTeam({role, sendChatNotification, teamname}))
    } else {
      const rootPath = ownProps.routePath.take(1)
      const sourceSubPath = ownProps.routePath.rest()
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
    }
  },
  onBack: () => {
    dispatch(RouteTreeGen.createNavigateUp())
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
    dispatch(RouteTreeGen.createNavigateUp())
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
      RouteTreeGen.createNavigateAppend({
        path: [
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
            selected: 'teamControlledRolePicker',
          },
        ],
      })
    )
  },
})

export default Container.compose(
  Container.connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  Container.compose(
    Container.withStateHandlers(
      {role: 'writer', sendNotification: true},
      {
        onRoleChange: () => role => ({role}),
        setSendNotification: () => sendNotification => ({sendNotification}),
      }
    ),
    Container.withPropsOnChange(['numberOfUsersSelected'], props => ({
      addButtonLabel: props.numberOfUsersSelected > 0 ? `Add (${props.numberOfUsersSelected})` : 'Add',
      onCancel: () => props.onClose(),
      title: `Add to ${props.name}`,
    })),
    Container.lifecycle({
      componentDidMount() {
        this.props._getSuggestions()
      },
    }),
    Container.withHandlers({
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
