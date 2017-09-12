// @flow
import NewTeamDialog from './'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import {createNewTeam} from '../../actions/teams/creators'
import {navigateTo} from '../../actions/route-tree'
import {isMobile} from '../../constants/platform'
import {chatTab} from '../../constants/tabs'

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onCreateNewTeam: name => {
    dispatch(createNewTeam(name))

    dispatch(navigateUp())
    if (isMobile) {
      dispatch(navigateTo([chatTab]))
    }
  },
  onBack: () => dispatch(navigateUp()),
})

export default compose(
  connect(null, mapDispatchToProps),
  withState('name', 'onNameChange', ''),
  withHandlers({
    onSubmit: ({name, _onCreateNewTeam}) => () => _onCreateNewTeam(name),
  })
)(NewTeamDialog)
