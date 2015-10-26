'use strict'

import BaseComponent from '../../base-component'
import React from '../../base-react'
import MoreTabs from './more'
import * as LoginActions from '../../actions/login'
import * as SearchActions from '../../actions/search'
import { navigateTo } from '../../actions/router'
import { pushNewProfile } from '../../actions/profile'

export default class More extends BaseComponent {
  constructor (props) {
    super(props)

    this.menu = [
      {name: 'Login', onClick: () => {
        this.props.dispatch(navigateTo(['login']))
      }},
      {name: 'Login2', onClick: () => {
        this.props.dispatch(navigateTo(['login2', 'welcome']))
      }},
      {name: 'Register', onClick: () => {
        this.props.dispatch(navigateTo(['login2', 'register']))
      }},
      {name: 'reset', onClick: () => {
        require('../../engine').reset()
        console.log('Engine reset!')
      }},
      {name: 'Sign Out', onClick: () => {
        this.props.dispatch(LoginActions.logout())
      }},
      {name: 'About', hasChildren: true, onClick: () => {
        this.props.dispatch(navigateTo(['about']))
      }},
      {name: 'Developer', hasChildren: true, onClick: () => {
        this.props.dispatch(navigateTo(['developer']))
      }},
      {name: 'Nav debug', hasChildren: true, onClick: () => {
        this.props.dispatch(navigateTo(['navDebug']))
      }},
      {name: 'Bridging', hasChildren: true, onClick: () => {
        this.props.dispatch(navigateTo(['bridging']))
      }},
      {name: 'QR', hasChildren: true, onClick: () => {
        this.props.dispatch(navigateTo(['qr']))
      }},
      {name: 'Search', hasChildren: true, onClick: () => {
        this.props.dispatch(SearchActions.pushNewSearch())
      }},
      {name: 'Profile', hasChildren: true, onClick: () => {
        this.props.dispatch(pushNewProfile('test12'))
      }}
    ]
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'More'
      },
      subRoutes: {
        'login': require('../../login'),
        'about': require('./about')
        //'developer': require('./developer'),
        //'navDebug': require('../../debug/nav-debug'),
        //'bridging': require('../../debug/bridging-tabs'),
        //'qr': require('../../qr'),
        //'login2': require('../../login2')
      }
    }
  }

  render () {
    return <MoreTabs items={this.menu}/>
  }
}

More.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}
