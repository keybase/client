'use strict'

import BaseComponent from '../../base-component'
import React from '../../base-react'
import MoreTabs from './more'
import { logout } from '../../actions/login2'
import { pushNewSearch } from '../../actions/search'
import { navigateTo } from '../../actions/router'
import { pushNewProfile } from '../../actions/profile'

export default class More extends BaseComponent {
  constructor (props) {
    super(props)

    this.menu = [
      {name: 'Login', onClick: () => {
        this.props.navigateTo(['login', 'loginform'])
      }},
      {name: 'Login2', onClick: () => {
        this.props.navigateTo(['login2', {path: 'welcome', upLink: ['about'], upTitle: 'About'}])
      }},
      {name: 'Register', onClick: () => {
        this.props.navigateTo(['login2', {path: 'register', upLink: ['']}])
      }},
      {name: 'reset', onClick: () => {
        require('../../engine').reset()
        console.log('Engine reset!')
      }},
      {name: 'Sign Out', onClick: () => {
        this.props.logout()
      }},
      {name: 'About', hasChildren: true, onClick: () => {
        this.props.navigateTo(['about'])
      }},
      {name: 'Developer', hasChildren: true, onClick: () => {
        this.props.navigateTo(['developer'])
      }},
      {name: 'Nav debug', hasChildren: true, onClick: () => {
        this.props.navigateTo(['navDebug'])
      }},
      {name: 'Bridging', hasChildren: true, onClick: () => {
        this.props.navigateTo(['bridging'])
      }},
      {name: 'Search', hasChildren: true, onClick: () => {
        this.props.pushNewSearch()
      }},
      {name: 'Profile', hasChildren: true, onClick: () => {
        this.props.pushNewProfile('test12')
      }}
    ]
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'More',
        mapStateToProps: state => { return {} },
        props: {
          navigateTo: uri => store.dispatch(navigateTo(uri)),
          logout: () => store.dispatch(logout()),
          pushNewSearch: () => store.dispatch(pushNewSearch()),
          pushNewProfile: username => store.dispatch(pushNewProfile(username))
        }
      },
      subRoutes: {
        'about': require('./about'),
        'developer': require('./developer'),
        'navDebug': require('../../debug/nav-debug'),
        'bridging': require('../../debug/bridging-tabs'),
        'login': require('../../login'),
        'login2': require('../../login2')
      }
    }
  }

  render () {
    return <MoreTabs items={this.menu}/>
  }
}

More.propTypes = {
  navigateTo: React.PropTypes.func.isRequired,
  logout: React.PropTypes.func.isRequired,
  pushNewSearch: React.PropTypes.func.isRequired,
  pushNewProfile: React.PropTypes.func.isRequired
}
