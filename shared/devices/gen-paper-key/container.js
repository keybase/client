// @flow
import Render from '../../login/signup/success/index.render'
import {compose, mapProps} from 'recompose'
import {connect} from 'react-redux-profiled'
import {navigateUp} from '../../actions/route-tree'
import {load, paperKeyMake} from '../../actions/devices'

const mapStateToProps = (state, {routeProps}) => ({
  paperkey: routeProps.paperKey,
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
