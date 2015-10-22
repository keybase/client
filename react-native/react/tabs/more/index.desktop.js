'use strict'

import React, { Component } from 'react'
import * as LoginActions from '../../actions/login'
import * as SearchActions from '../../actions/search'
import { navigateTo } from '../../actions/router'
import { pushNewProfile } from '../../actions/profile'
//import Button from '../../common-adapters/button'
import { List, ListItem, RaisedButton } from 'material-ui'

export default class More extends Component {
  constructor (props) {
    super(props)
    this.state = {}
  }

  componentWillMount () {
    this.setState({
      items: [
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
    })
  }

  render () {
    return (
      <List>
        {this.state.items.map((title) => {
          return <ListItem key={title.name} onClick={title.onClick}>{title.name}</ListItem>
        })}
      </List>
    )
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
}
