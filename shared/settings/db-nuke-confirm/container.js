// @flow
import {navigateUp} from '../../actions/route-tree'
import DBNukeConfirm from './index'
import {createDbNuke} from '../../actions/settings-gen'
import {connect} from '../../util/container'

type OwnProps = {||}
const mapStateToProps = () => ({})
const mapDispatchToProps = dispatch => ({
  onCancel: () => {
    dispatch(navigateUp())
  },
  onDBNuke: () => {
    dispatch(navigateUp())
    dispatch(createDbNuke())
  },
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(DBNukeConfirm)
