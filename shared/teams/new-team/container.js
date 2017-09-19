// @flow
import NewTeamDialog from './'
import {connect} from 'react-redux'
import {compose, withState, withHandlers} from 'recompose'
import {createNewTeam} from '../../actions/teams/creators'
import {navigateTo} from '../../actions/route-tree'
import {isMobile} from '../../constants/platform'
import {chatTab} from '../../constants/tabs'
import {upperFirst} from 'lodash'
import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState) => ({
  errorText: upperFirst(state.chat.teamCreationError),
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _onCreateNewTeam: name => {
    dispatch(createNewTeam(name))
  },
  onBack: () => dispatch(navigateUp()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('name', 'onNameChange', ''),
  withHandlers({
    onSubmit: ({name, _onCreateNewTeam}) => () => _onCreateNewTeam(name),
  })
)(NewTeamDialog)
