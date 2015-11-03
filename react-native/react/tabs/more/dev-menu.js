'use strict'

import React from '../../base-react'
import BaseComponent from '../../base-component'
import { routeAppend } from '../../actions/router'
import { pushNewProfile } from '../../actions/profile'
import { pushNewSearch } from '../../actions/search'
import { logout } from '../../actions/login2'
import MenuList from './menu-list'

export default class DevMenu extends BaseComponent {
  render () {
    const menuItems = [
      {name: 'Login', onClick: () => {
        this.props.routeAppend(['login', {path: 'loginform', upLink: ['']}])
      }},
      {name: 'Login2', onClick: () => {
        this.props.routeAppend(['login2', {path: 'welcome', upLink: ['about'], upTitle: 'About'}])
      }},
      {name: 'Register', onClick: () => {
        this.props.routeAppend(['login2', {path: 'register', upLink: ['']}])
      }},
      {name: 'reset', onClick: () => {
        require('../../engine').reset()
        console.log('Engine reset!')
      }},
      {name: 'Sign Out', onClick: () => {
        this.props.logout()
      }},
      {name: 'About', hasChildren: true, onClick: () => {
        this.props.routeAppend(['about'])
      }},
      {name: 'Developer', hasChildren: true, onClick: () => {
        this.props.routeAppend('developer')
      }},
      {name: 'Nav debug', hasChildren: true, onClick: () => {
        this.props.routeAppend('navDebug')
      }},
      {name: 'Bridging', hasChildren: true, onClick: () => {
        this.props.routeAppend('bridging')
      }},
      {name: 'Search', hasChildren: true, onClick: () => {
        this.props.pushNewSearch()
      }},
      {name: 'Profile', hasChildren: true, onClick: () => {
        this.props.pushNewProfile('test12')
      }}
    ]
    return (
      <MenuList items={menuItems} />
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Dev Menu',
        mapStateToProps: state => { return {} },
        props: {
          routeAppend: uri => store.dispatch(routeAppend(uri)),
          logout: () => store.dispatch(logout()),
          pushNewSearch: () => store.dispatch(pushNewSearch()),
          pushNewProfile: username => store.dispatch(pushNewProfile(username))
        }
      },
      subRoutes: {
        about: require('./about'),
        developer: require('./developer'),
        navDebug: require('../../debug/nav-debug'),
        bridging: require('../../debug/bridging-tabs'),
        login: require('../../login'),
        login2: require('../../login2')
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
