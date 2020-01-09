// Switches between the route-tree router and the new router, will go away
import * as React from 'react'
import Router from './router'
import * as Kbfs from '../fs/common'
import {connect} from '../util/container'
import * as ConfigGen from '../actions/config-gen'
import * as Constants from '../constants/config'

type OwnProps = {}

type Props = {
  updateNavigator: (nav: unknown) => void
  persistRoute: (path: Array<any>) => void
  isDarkMode: boolean
}

const RouterSwitcheroo = React.memo((props: Props) => {
  Kbfs.useFsBadge()
  return (
    <Router
      ref={r => props.updateNavigator(r)}
      persistRoute={props.persistRoute}
      isDarkMode={props.isDarkMode}
    />
  )
})

export default connect(
  state => ({isDarkMode: Constants.isDarkMode(state.config)}),
  dispatch => ({
    persistRoute: (path: Array<any>) => dispatch(ConfigGen.createPersistRoute({path})),
    updateNavigator: navigator => dispatch(ConfigGen.createSetNavigator({navigator})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(RouterSwitcheroo)
