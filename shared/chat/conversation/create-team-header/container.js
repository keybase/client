// @flow
import CreateTeamHeader from '.'
import {connect} from 'react-redux'
import {navigateAppend} from '../../../actions/route-tree'

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onShowNewTeamDialog: () => {
    dispatch(navigateAppend(['showNewTeamDialog']))
  },
})

export default connect(null, mapDispatchToProps)(CreateTeamHeader)
