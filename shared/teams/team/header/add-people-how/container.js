// @flow
import {connect} from '../../../../util/container'
import {AddPeopleHow} from '.'
import {navigateTo, navigateUp} from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  return {
    onAddPeople: () => dispatch(navigateTo([{selected: 'addPeople', props: {teamname}}], [teamsTab, 'team'])),
    onClose: () => {
      dispatch(navigateUp())
    },
    onInvite: () =>
      dispatch(navigateTo([{selected: 'inviteByEmail', props: {teamname}}], [teamsTab, 'team'])),
  }
}

export default connect(undefined, mapDispatchToProps)(AddPeopleHow)
