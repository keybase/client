import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as SearchGen from '../../actions/search-gen'
import * as SearchConstants from '../../constants/search'
import * as WaitingConstants from '../../constants/waiting'
import {sendNotificationFooter} from '../role-picker'
import * as Types from '../../constants/types/teams'
import {
  getRole,
  getDisabledReasonsForRolePicker,
  addPeopleToTeamWaitingKey,
  getTeamType,
} from '../../constants/teams'
import {upperFirst} from 'lodash-es'
import AddPeople, {AddPeopleProps} from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'

type OwnProps = Container.RouteProps<
  {
    teamname: string
  },
  {}
>

const mapStateToProps = (state, ownProps) => {
  const teamname = Container.getRouteProps(ownProps, 'teamname')
  return {
    _notifLabel:
      getTeamType(state, teamname) === 'big' ? `Announce them in #general` : `Announce them in team chat`,
    _yourRole: getRole(state, teamname),
    disabledReasonsForRolePicker: getDisabledReasonsForRolePicker(state, teamname, null),
    errorText: upperFirst(state.teams.teamInviteError),
    name: teamname,
    numberOfUsersSelected: SearchConstants.getUserInputItemIds(state, 'addToTeamSearch').size,
    waiting: WaitingConstants.anyWaiting(state, addPeopleToTeamWaitingKey(teamname)),
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _addPeople: (role: string, sendChatNotification: boolean) => {
    const teamname = Container.getRouteProps(ownProps, 'teamname')
    dispatch(TeamsGen.createAddPeopleToTeam({role, sendChatNotification, teamname}))
  },
  _getSuggestions: () => dispatch(SearchGen.createSearchSuggestions({searchKey: 'addToTeamSearch'})),
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
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  return {
    _addPeople: dispatchProps._addPeople,
    _getSuggestions: dispatchProps._getSuggestions,
    _notifLabel: stateProps._notifLabel,
    addButtonLabel:
      stateProps.numberOfUsersSelected > 0 ? `Add (${stateProps.numberOfUsersSelected})` : 'Add',
    disabledReasonsForRolePicker: stateProps.disabledReasonsForRolePicker,
    errorText: stateProps.errorText,
    name: stateProps.name,
    numberOfUsersSelected: stateProps.numberOfUsersSelected,
    onClearSearch: dispatchProps.onClearSearch,
    onClose: dispatchProps.onClose,
    title: `Add to ${stateProps.name}`,
    waiting: stateProps.waiting,
  }
}

type State = {
  rolePickerOpen: boolean
  selectedRole: Types.TeamRoleType
  sendNotification: boolean
}

type ExtraProps = {
  _addPeople: (role: Types.TeamRoleType, sendNotification: boolean) => void
  _getSuggestions: () => void
  _notifLabel: string
}

class AddPeopleStateWrapper extends React.Component<AddPeopleProps & ExtraProps, State> {
  state = {
    rolePickerOpen: false,
    selectedRole: 'writer' as Types.TeamRoleType,
    sendNotification: true,
  }
  _setRef = false

  componentDidMount() {
    this.props._getSuggestions()
  }

  render() {
    const {_addPeople, _getSuggestions, _notifLabel, ...rest} = this.props
    return (
      <AddPeople
        {...rest}
        onOpenRolePicker={() => this.setState({rolePickerOpen: true})}
        isRolePickerOpen={this.state.rolePickerOpen}
        onCancelRolePicker={() => this.setState({rolePickerOpen: false})}
        onEditMembership={() => this.setState({rolePickerOpen: true})}
        onConfirmRolePicker={role => {
          this.setState({rolePickerOpen: false})
          _addPeople(role, this.state.sendNotification)
        }}
        confirmLabel={
          this.state.selectedRole
            ? `Add as ${this.state.selectedRole}${this.props.numberOfUsersSelected > 1 ? 's' : ''}`
            : undefined
        }
        footerComponent={sendNotificationFooter(_notifLabel, this.state.sendNotification, nextVal =>
          this.setState({sendNotification: nextVal})
        )}
        onSelectRole={selectedRole => this.setState({selectedRole})}
        selectedRole={this.state.selectedRole}
      />
    )
  }
}

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(AddPeopleStateWrapper)
