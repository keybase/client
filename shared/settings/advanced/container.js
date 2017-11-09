// @flow
import {navigateAppend, navigateUp} from '../../actions/route-tree'
import {HeaderHoc} from '../../common-adapters'
import {compose} from 'recompose'
import DBNuke from './index'
import {connect} from 'react-redux'

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => {
    dispatch(navigateUp())
  },
  onDBNuke: () => {
    dispatch(navigateAppend(['dbNukeConfirm']))
  },
})

const connectedDBNuke = compose(connect(mapStateToProps, mapDispatchToProps), HeaderHoc)(DBNuke)
export default connectedDBNuke
