// @flow
import * as DevicesGen from '../../actions/devices-gen'
import Render from '../../login/signup/success/index.render'
import {connect} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'

const mapStateToProps = (state, {routeProps}) => ({
  paperkey: routeProps.get('paperKey'),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  generatePaperKey: () => dispatch(DevicesGen.createPaperKeyMake()),
  onBack: () => dispatch(navigateUp()),
  onFinish: () => {
    dispatch(DevicesGen.createDevicesLoad())
    dispatch(navigateUp())
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  title: 'Paper key generated!',
  waiting: false,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Render)
