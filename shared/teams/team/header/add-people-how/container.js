// @flow
import {connect, isMobile} from '../../../../util/container'
import {AddPeopleHow} from '.'
import {navigateTo, navigateUp, switchTo} from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => {
  const teamname = routeProps.get('teamname')
  return {
    onAddPeople: () => {
      !isMobile && dispatch(navigateUp())
      dispatch(
        navigateTo(
          [{selected: 'team', props: {teamname}}, {selected: 'addPeople', props: {teamname}}],
          [teamsTab]
        )
      )
      dispatch(switchTo([teamsTab]))
    },
    onClose: () => {
      dispatch(navigateUp())
    },
    onInvite: () => {
      !isMobile && dispatch(navigateUp())
      dispatch(
        navigateTo(
          [{selected: 'team', props: {teamname}}, {selected: 'inviteByEmail', props: {teamname}}],
          [teamsTab]
        )
      )
      dispatch(switchTo([teamsTab]))
    },
  }
}

export default connect(undefined, mapDispatchToProps)(AddPeopleHow)
