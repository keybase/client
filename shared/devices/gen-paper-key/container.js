// @flow
import * as DevicesGen from '../../actions/devices-gen'
import Render from '../../login/signup/success/index.render'
import {connect, compose, mapProps} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'

const mapStateToProps = (state, {routeProps}) => ({
  paperkey: routeProps.get('paperKey'),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  generatePaperKey: () => dispatch(DevicesGen.createPaperKeyMake()),
  onBack: () => dispatch(navigateUp()),
  onFinish: () => {
    dispatch(DevicesGen.createLoad())
    dispatch(navigateUp())
  },
})

const makeRenderProps = props => ({
  ...props,
  title: 'Paper key generated!',
  waiting: false,
})

export default compose(connect(mapStateToProps, mapDispatchToProps), mapProps(makeRenderProps))(Render)
