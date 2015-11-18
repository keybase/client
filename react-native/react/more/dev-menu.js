'use strict'

import React, {Component} from '../base-react'
import {connect} from '../base-redux'
import {routeAppend} from '../actions/router'
import {pushNewProfile} from '../actions/profile'
import {pushNewSearch} from '../actions/search'
import {logout} from '../actions/login'
import MenuList from './menu-list'

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
        require('../engine').reset()
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
      {name: 'Tracker (normal)', hasChildren: true, onClick: () => {
        this.props.routeAppend([{path: 'tracker', state: 'normal'}])
      }},
      {name: 'Tracker (warning)', hasChildren: true, onClick: () => {
        this.props.routeAppend([{path: 'tracker', state: 'warning'}])
      }},
      {name: 'Tracker (error)', hasChildren: true, onClick: () => {
        this.props.routeAppend([{path: 'tracker', state: 'error'}])
      }}
    ]
    return (
      <MenuList items={menuItems} />
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Dev Menu'},
      subRoutes: {
        developer: require('./developer'),
        login: require('../login'),
        pinentry: require('../pinentry'),
        tracker: require('../tracker')
      }
    }
  }
}

DevMenu.propTypes = {
  routeAppend: React.PropTypes.func.isRequired,
  logout: React.PropTypes.func.isRequired,
  pushNewSearch: React.PropTypes.func.isRequired,
  pushNewProfile: React.PropTypes.func.isRequired
}

export default connect(
  null,
  dispatch => {
    return {
      routeAppend: uri => dispatch(routeAppend(uri)),
      logout: () => dispatch(logout()),
      pushNewSearch: () => dispatch(pushNewSearch()),
      pushNewProfile: username => dispatch(pushNewProfile(username))
    }
  }
)(DevMenu)
