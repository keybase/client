// @flow
import {connect} from '../../../../util/container'
import {AddPeopleHow} from '.'
import {navigateUp} from '../../../../actions/route-tree'

const mapStateToProps = () => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClose: () => dispatch(navigateUp()),
})

export default connect(mapStateToProps, mapDispatchToProps)(AddPeopleHow)
