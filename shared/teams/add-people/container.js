// @flow
import * as TeamsGen from '../../actions/teams-gen'
import * as SearchGen from '../../actions/search-gen'
import * as SearchConstants from '../../constants/search'
import {getRole, isOwner} from '../../constants/teams'
import AddPeople from '.'
import {HeaderHoc} from '../../common-adapters'
import {navigateAppend} from '../../actions/route-tree'
import {
  connect,
  compose,
  lifecycle,
  withHandlers,
  withPropsOnChange,
  withState,
  type TypedState,
} from '../../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  return {
    isEmpty: SearchConstants.getUserInputItemIds(state, {searchKey: 'addToTeamSearch'}).length === 0,
    name: teamname,
    _yourRole: getRole(state, teamname),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  _getSuggestions: () => dispatch(SearchGen.createSearchSuggestions({searchKey: 'addToTeamSearch'})),
  onAddPeople: (role: string, sendChatNotification: boolean) => {
    dispatch(
      TeamsGen.createAddPeopleToTeam({teamname: routeProps.get('teamname'), role, sendChatNotification})
    )
    dispatch(navigateUp())
    dispatch(TeamsGen.createGetTeams())
    dispatch(SearchGen.createClearSearchResults({searchKey: 'addToTeamSearch'}))
    dispatch(SearchGen.createSetUserInputItems({searchKey: 'addToTeamSearch', searchResults: []}))
  },
  onClose: () => {
    dispatch(navigateUp())
    dispatch(SearchGen.createClearSearchResults({searchKey: 'addToTeamSearch'}))
    dispatch(SearchGen.createSetUserInputItems({searchKey: 'addToTeamSearch', searchResults: []}))
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
            allowOwner,
            onComplete,
            selectedRole: role,
            sendNotificationChecked: sendNotification,
            showNotificationCheckbox: true,
          },
          selected: 'controlledRolePicker',
        },
      ])
    )
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  compose(
    withState('role', 'onRoleChange', 'writer'),
    withState('sendNotification', 'setSendNotification', true),
    withPropsOnChange(['onExitSearch'], props => ({
      onCancel: () => props.onClose(),
      title: 'Add people',
    })),
    lifecycle({
      componentWillMount: function() {
        this.props._getSuggestions()
      },
    }),
    withHandlers({
      onAddPeople: ({onAddPeople, role, sendNotification}) => () =>
        role && onAddPeople(role, sendNotification),
      onOpenRolePicker: ({
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
        })
      },
    }),
    HeaderHoc
  )
)(AddPeople)
