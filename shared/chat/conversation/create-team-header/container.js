// @flow
import CreateTeamHeader from '.'
import {connect} from 'react-redux'
import {navigateAppend} from '../../../actions/route-tree'

export type DispatchProps = {|
  _onShowNewTeamDialog: () => void,
|}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onShowNewTeamDialog: () => {
    dispatch(navigateAppend(['showNewTeamDialog']))
  },
})

export default connect(undefined, mapDispatchToProps)(CreateTeamHeader)
