// Switches between the route-tree router and the new router, will go away
import * as React from 'react'
import Router from './router'
import {connect} from '../util/container'
import * as ConfigGen from '../actions/config-gen'

type OwnProps = {}

type Props = {
  updateNavigator: (arg0: any) => void
  persistRoute: (arg0: any) => void
}

// TODO remove this class
class RouterSwitcheroo extends React.PureComponent<Props> {
  render() {
    return <Router ref={r => this.props.updateNavigator(r)} persistRoute={this.props.persistRoute} />
  }
}

const mapDispatchToProps = dispatch => ({
  persistRoute: path => dispatch(ConfigGen.createPersistRoute({path})),
  updateNavigator: navigator => dispatch(ConfigGen.createSetNavigator({navigator})),
})

export default connect(
  () => ({}),
  mapDispatchToProps,
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(RouterSwitcheroo)
