import React, {Component} from '../base-react'
import {connect} from '../base-redux'
import {routeAppend} from '../actions/router'
import {pushNewProfile} from '../actions/profile'
import {pushNewSearch} from '../actions/search'
import {logout} from '../actions/login'
import {pushDebugTracker} from '../actions/tracker'
import MenuList from './menu-list'

import developer from './developer'
import login from '../login'
import pinentry from '../pinentry'
import tracker from '../tracker'
import components from './component-sheet'
import styleSheet from './style-sheet'
import engine from '../engine'

class DevMenu extends Component {
  render () {
    const menuItems = [
      {name: 'Login', onClick: () => {
        this.props.routeAppend(['login', {path: 'welcome', upLink: ['about'], upTitle: 'About'}])
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
      {name: 'Passphrase entry', onClick: () => {
        this.props.routeAppend('pinentry')
      }},
      {name: 'Developer', hasChildren: true, onClick: () => {
        this.props.routeAppend('developer')
      }},
      {name: 'Search', hasChildren: true, onClick: () => {
        this.props.pushNewSearch()
      }},
      {name: 'Profile', hasChildren: true, onClick: () => {
        this.props.pushNewProfile('test12')
      }},
      {name: 'Tracker Listener', hasChildren: true, onClick: () => {
        this.props.showTrackerListener('max')
      }},
      {name: 'Tracker (normal)', hasChildren: true, onClick: () => {
        this.props.routeAppend([{path: 'tracker', state: 'normal'}])
      }},
      {name: 'Tracker (warning)', hasChildren: true, onClick: () => {
        this.props.routeAppend([{path: 'tracker', state: 'warning'}])
      }},
      {name: 'Tracker (error)', hasChildren: true, onClick: () => {
        this.props.routeAppend([{path: 'tracker', state: 'error'}])
      }},
      {name: 'Remote Window', hasChildren: true, onClick: () => {
        // this.props.routeAppend([{parseRoute: {componentAtTop: {component: Foo}}}])
      }},
      {name: 'Components', hasChildren: true, onClick: () => {
        this.props.routeAppend(['components'])
      }},
      {name: 'Stylesheet', hasChildren: true, onClick: () => {
        this.props.routeAppend(['styleSheet'])
      }}
    ]
    return (
      <MenuList items={menuItems} />
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Dev Menu'},
      subRoutes: { developer, login, pinentry, tracker, components, styleSheet }
    }
  }
}

DevMenu.propTypes = {
  routeAppend: React.PropTypes.func.isRequired,
  logout: React.PropTypes.func.isRequired,
  pushNewSearch: React.PropTypes.func.isRequired,
  pushNewProfile: React.PropTypes.func.isRequired,
  showTrackerListener: React.PropTypes.func.isRequired
}

export default connect(
  null,
  dispatch => {
    return {
      routeAppend: uri => dispatch(routeAppend(uri)),
      logout: () => dispatch(logout()),
      pushNewSearch: () => dispatch(pushNewSearch()),
      pushNewProfile: username => dispatch(pushNewProfile(username)),
      showTrackerListener: username => dispatch(pushDebugTracker(username))
    }
  }
)(DevMenu)
