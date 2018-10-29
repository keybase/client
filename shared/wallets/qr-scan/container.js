// @flow
import QRScan from '.'
import {connect} from '../../util/container'

const mapStateToProps = () => ({})
const mapDispatchToProps = dispatch => ({})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...dispatchProps,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(QRScan)
