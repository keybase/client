'use strict'

import React, { Component } from '../../base-react'
import { navigateTo } from '../../actions/router'
import MenuList from './menu-list'
import { isDev } from '../../constants/platform'

export default class More extends Component {
  constructor (props) {
    super(props)

    const dummyInvitationCount = 3
    // TODO: actually get this data
    this.state = {
      menuItems: [
        {name: 'Account', hasChildren: true, onClick: () => {
          this.props.navigateTo(['account'])
        }},
        {name: 'Billing Settings', hasChildren: true, onClick: () => {
          this.props.navigateTo(['billing'])
        }},
        {name: 'App Preferences', hasChildren: true, onClick: () => {
          this.props.navigateTo(['app-prefs'])
        }},
        {name: `Invitations (${dummyInvitationCount})`, hasChildren: true, onClick: () => {
          this.props.navigateTo(['invites'])
        }},
        {name: 'Notifications', hasChildren: true, onClick: () => {
          this.props.navigateTo(['notifs'])
        }},
        {name: 'Delete me', hasChildren: true, onClick: () => {
          this.props.navigateTo(['delete-me'])
        }},
        {name: 'About', hasChildren: true, onClick: () => {
          this.props.navigateTo(['about'])
        }}
      ]
    }

    if (isDev) {
      this.state.menuItems.push({
        name: 'Dev Menu',
        hasChildren: true,
        onClick: () => this.props.navigateTo(['devMenu'])
      })
    }
  }

  render () {
    return <MenuList items={this.state.menuItems}/>
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'More',
        props: {
          navigateTo: uri => store.dispatch(navigateTo(uri))
        }
      },
      subRoutes: {
        about: require('./about'),
        account: require('./account'),
        billing: require('./about'),
        appPrefs: require('./about'),
        invites: require('./about'),
        notifs: require('./about'),
        deleteMe: require('./about'),
        devMenu: require('./dev-menu')
      }
    }
  }
}

More.propTypes = {
  navigateTo: React.PropTypes.func.isRequired
}
