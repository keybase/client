// Switches between the route-tree router and the new router, will go away
import * as React from 'react'
import Router from './router'
import {connect} from '../util/container'
import * as ConfigGen from '../actions/config-gen'

type OwnProps = {}

type Props = {
  updateNavigator: (nav: unknown) => void
  persistRoute: (path: string) => void
}

// TODO remove this class
class RouterSwitcheroo extends React.PureComponent<Props> {
  render() {
    return <Router ref={r => this.props.updateNavigator(r)} persistRoute={this.props.persistRoute} />
  }
}

export default connect(
  () => ({}),
  dispatch => ({
    persistRoute: path => dispatch(ConfigGen.createPersistRoute({path})),
    updateNavigator: navigator => dispatch(ConfigGen.createSetNavigator({navigator})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(RouterSwitcheroo)
