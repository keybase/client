import React, {Component} from 'react'
import {connect} from 'react-redux'
import {routeAppend} from '../actions/router'
import {switchTab} from '../actions/tabbed-router'
import {logout} from '../actions/login'
import {pushDebugTracker} from '../actions/tracker'
import MenuList from '../settings/menu-list'

import {loginTab} from '../constants/tabs'
import engine from '../engine'

import search from '../search'
import developer from './developer'
import login from '../login'
import components from './component-sheet'
import styleSheet from './style-sheet'
import dumbSheet from './dumb-sheet'

class DevMenu extends Component {
  render () {
    const menuItems = [
      {name: 'Login', onClick: () => {
        this.props.switchTab(loginTab)
      }},
      {name: 'Register', onClick: () => {
        this.props.routeAppend(['login', {path: 'register', upLink: ['']}])
      }},
      {name: 'reset', onClick: () => {
        engine.reset()
        console.log('Engine reset!')
      }},
      {name: 'Sign Out', onClick: () => {
        this.props.logout()
      }},
      {name: 'Developer', hasChildren: true, onClick: () => {
        this.props.routeAppend('developer')
      }},
      {name: 'Search', hasChildren: true, onClick: () => {
        this.props.routeAppend('search')
      }},
      {name: 'Components', hasChildren: true, onClick: () => {
        this.props.routeAppend('components')
      }},
      {name: 'Stylesheet', hasChildren: true, onClick: () => {
        this.props.routeAppend('styleSheet')
      }},
      {name: 'Dumb components', hasChildren: true, onClick: () => {
        this.props.routeAppend('dumbSheet')
      }},
    ]
    return (
      <MenuList items={menuItems} />
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Dev Menu'},
      subRoutes: {developer, login, components, styleSheet, dumbSheet, search},
    }
  }
}

DevMenu.propTypes = {
  routeAppend: React.PropTypes.func.isRequired,
  logout: React.PropTypes.func.isRequired,
  showTrackerListener: React.PropTypes.func.isRequired,
  switchTab: React.PropTypes.func.isRequired,
}

export default connect(
  null,
  dispatch => {
    return {
      routeAppend: uri => dispatch(routeAppend(uri)),
      switchTab: tabName => dispatch(switchTab(tabName)),
      logout: () => dispatch(logout()),
      showTrackerListener: username => dispatch(pushDebugTracker(username)),
    }
  }
)(DevMenu)
