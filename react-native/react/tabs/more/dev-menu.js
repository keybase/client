'use strict'

import React, { Component } from '../../base-react'
import {connect} from 'redux'
import { routeAppend } from '../../actions/router'
import { pushNewProfile } from '../../actions/profile'
import { pushNewSearch } from '../../actions/search'
import { logout } from '../../actions/login2'
import MenuList from './menu-list'

import RemoteWindow from '../../native/remote-window'

class Foo extends Component {
  render () {
    const payload = { 
      features: { 
        secretStorage: { allow: true, label: 'store your test passphrase' }
      },
      prompt: 'Enter a test passphrase',
      retryLabel: '',
      windowTitle: 'Keybase Test Passphrase'
    }
    return <RemoteWindow 
             component='pinentry'
             payload={payload}/>
  }
}

export default class DevMenu extends Component {
  render () {
    const menuItems = [
      {name: 'Login', onClick: () => {
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
      }},
      {name: 'Remote Window', hasChildren: true, onClick: () => {
        this.props.routeAppend([{parseRoute: { componentAtTop: { component: Foo } }}])
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
        developer: require('./developer'),
        login2: require('../../login2'),
        pinentry: require('../../pinentry'),
        tracker: require('../../tracker')
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
