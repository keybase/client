// @flow
// Switches between the route-tree router and the new router, will go away
import * as React from 'react'
import Router from './router'
import {connect} from '../util/container'
import * as ConfigGen from '../actions/config-gen'

type OwnProps = {||}

type Props = {|
  updateNavigator: any => void,
  persistRoute: any => void,
|}

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

export default connect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(RouterSwitcheroo)
