// @flow
import * as Creators from '../../actions/teams/creators'
import * as SearchCreators from '../../actions/search/creators'
import * as SearchConstants from '../../constants/search'
import {teamMemberRecordSelector} from '../../constants/selectors'
import AddPeople from '.'
import {HeaderHoc} from '../../common-adapters'
import {navigateAppend} from '../../actions/route-tree'
import {
  connect,
  compose,
  withHandlers,
  withPropsOnChange,
  withState,
  type TypedState,
} from '../../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  isEmpty: SearchConstants.getUserInputItemIds(state, {searchKey: 'addToTeamSearch'}).length === 0,
  name: routeProps.get('teamname'),
  _yourMember: teamMemberRecordSelector(state, {teamname: routeProps.get('teamname')}),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onAddPeople: (role: string, sendNotification: boolean) => {
    dispatch(Creators.addPeopleToTeam(routeProps.get('teamname'), role, sendNotification))
    dispatch(navigateUp())
    dispatch(Creators.getTeams())
    dispatch(SearchCreators.clearSearchResults('addToTeamSearch'))
    dispatch(SearchCreators.setUserInputItems('addToTeamSearch', []))
  },
  onClose: () => {
    dispatch(navigateUp())
    dispatch(SearchCreators.clearSearchResults('addToTeamSearch'))
    dispatch(SearchCreators.setUserInputItems('addToTeamSearch', []))
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
    withHandlers({
      onAddPeople: ({onAddPeople, role, sendNotification}) => () =>
        role && onAddPeople(role, sendNotification),
      onOpenRolePicker: ({
        onOpenRolePicker,
        role,
        onRoleChange,
        sendNotification,
        setSendNotification,
        yourMember,
      }) => () => {
        onOpenRolePicker(role, sendNotification, yourMember.type === 'owner', (role, sendNotification) => {
          onRoleChange(role)
          setSendNotification(sendNotification)
        })
      },
    }),
    HeaderHoc
  )
)(AddPeople)
