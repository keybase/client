// @flow
import Render from '../../login/signup/success/index.render'
import {connect, compose, mapProps} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'
import {load, paperKeyMake} from '../../actions/devices'

const mapStateToProps = (state, {routeProps}) => ({
  paperkey: routeProps.get('paperKey'),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  generatePaperKey: () => dispatch(paperKeyMake()),
  onBack: () => dispatch(navigateUp()),
  onFinish: () => {
    dispatch(load())
    dispatch(navigateUp())
  },
})

const makeRenderProps = props => ({
  ...props,
  title: 'Paper key generated!',
  waiting: false,
})

export default compose(connect(mapStateToProps, mapDispatchToProps), mapProps(makeRenderProps))(Render)
