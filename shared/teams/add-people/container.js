// @flow
import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as SearchGen from '../../actions/search-gen'
import * as SearchConstants from '../../constants/search'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/teams'
import {getRole, getDisabledReasonsForRolePicker} from '../../constants/teams'
import {upperFirst} from 'lodash-es'
import AddPeople, {type AddPeopleProps} from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import flags from '../../util/feature-flags'

type OwnProps = Container.RouteProps<{teamname: string}, {}>

const mapStateToProps = (state, ownProps) => {
  const teamname = Container.getRouteProps(ownProps, 'teamname')
  return {
    _yourRole: getRole(state, teamname),
    disabledReasonsForRolePicker: getDisabledReasonsForRolePicker(state, teamname, null),
    errorText: upperFirst(state.teams.teamInviteError),
    name: teamname,
    numberOfUsersSelected: SearchConstants.getUserInputItemIds(state, 'addToTeamSearch').size,
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  _addPeople: (role: string, sendChatNotification: boolean) => {
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

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  return {
    _addPeople: dispatchProps._addPeople,
    _getSuggestions: dispatchProps._getSuggestions,
    addButtonLabel:
      stateProps.numberOfUsersSelected > 0 ? `Add (${stateProps.numberOfUsersSelected})` : 'Add',
    disabledReasonsForRolePicker: stateProps.disabledReasonsForRolePicker,
    errorText: stateProps.errorText,
    name: stateProps.name,
    numberOfUsersSelected: stateProps.numberOfUsersSelected,
    onClearSearch: dispatchProps.onClearSearch,
    onClose: dispatchProps.onClose,
    title: `Add to ${stateProps.name}`,
  }
}

type State = {
  rolePickerOpen: boolean,
  selectedRole: ?Types.TeamRoleType,
  sendNotification: boolean,
}

type ExtraProps = {
  _addPeople: (role: Types.TeamRoleType, sendNotification: boolean) => void,
  _getSuggestions: () => void,
}

class AddPeopleStateWrapper extends React.Component<AddPeopleProps & ExtraProps, State> {
  state = {
    rolePickerOpen: false,
    selectedRole: null,
    sendNotification: false,
  }
  _setRef = false

  componentDidMount() {
    this.props._getSuggestions()
  }

  render() {
    const {_addPeople, _getSuggestions, ...rest} = this.props
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
        footerComponent={
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            centerChildren={true}
            style={{
              paddingBottom: Styles.globalMargins.tiny,
              paddingTop: Styles.globalMargins.tiny,
            }}
          >
            <Kb.Checkbox
              checked={this.state.sendNotification}
              onCheck={nextVal => this.setState({sendNotification: nextVal})}
              label="Send chat notification"
            />
          </Kb.Box2>
        }
        onSelectRole={selectedRole => this.setState({selectedRole})}
        selectedRole={this.state.selectedRole}
      />
    )
  }
}

export default Container.connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(AddPeopleStateWrapper)
