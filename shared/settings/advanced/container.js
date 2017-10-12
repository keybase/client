// @flow
import {navigateAppend} from '../../actions/route-tree'
import {dbNuke} from '../../actions/settings'
import DBNuke from './index'
import {connect} from 'react-redux'

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onDBNuke: () => {
    dispatch(navigateAppend(['dbNukeConfirm']))
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(DBNuke)
