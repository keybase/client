// @flow
import * as TeamsGen from '../../actions/teams-gen'
import * as SearchGen from '../../actions/search-gen'
import * as SearchConstants from '../../constants/search'
import {getRole, isOwner, teamWaitingKey} from '../../constants/teams'
import {upperFirst} from 'lodash-es'
import AddPeople from '.'
import {HeaderHoc} from '../../common-adapters'
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
    isEmpty: SearchConstants.getUserInputItemIds(state, {searchKey: 'addToTeamSearch'}).length === 0,
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
    withStateHandlers(
      {role: 'writer', sendNotification: true},
      {
        setSendNotification: () => sendNotification => ({sendNotification}),
        onRoleChange: () => role => ({role}),
      }
    ),
    withPropsOnChange(['onExitSearch'], props => ({
      onCancel: () => props.onClose(),
      title: 'Add people',
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
