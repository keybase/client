// Switches between the route-tree router and the new router, will go away
import * as React from 'react'
import Router from './router'
import {connect} from '../util/container'
import * as ConfigGen from '../actions/config-gen'
import * as Constants from '../constants/config'

type OwnProps = {}

type Props = {
  updateNavigator: (nav: unknown) => void
  persistRoute: (path: Array<any>) => void
  isDarkMode: boolean
}

// TODO remove this class
class RouterSwitcheroo extends React.PureComponent<Props> {
  render() {
    return (
      <Router
        ref={r => this.props.updateNavigator(r)}
        persistRoute={this.props.persistRoute}
        isDarkMode={this.props.isDarkMode}
      />
    )
  }
}

export default connect(
  state => ({isDarkMode: Constants.isDarkMode(state.config)}),
  dispatch => ({
      persistRoute: (path: Array<any>) => dispatch(ConfigGen.createPersistRoute({path})),
    updateNavigator: navigator => dispatch(ConfigGen.createSetNavigator({navigator})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(RouterSwitcheroo)
