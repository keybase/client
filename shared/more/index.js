import React, {Component} from 'react'
import {connect} from 'react-redux'
import {navigateTo} from '../actions/router'
import MenuList from './menu-list'

import about from './about'
import account from './account'
import billing from './about'
import appPrefs from './about'
import invites from './about'
import notifs from './about'
import deleteMe from './about'
import devMenu from './dev-menu'

class More extends Component {
  constructor (props) {
    super(props)

    const dummyInvitationCount = 3
    // TODO: actually get this data
    this.state = {
      menuItems: [
        {name: 'Account', hasChildren: true, onClick: () => { this.props.navigateTo(['account']) }},
        {name: 'Billing Settings', hasChildren: true, onClick: () => { this.props.navigateTo(['billing']) }},
        {name: 'App Preferences', hasChildren: true, onClick: () => { this.props.navigateTo(['app-prefs']) }},
        {name: `Invitations (${dummyInvitationCount})`, hasChildren: true, onClick: () => { this.props.navigateTo(['invites']) }},
        {name: 'Notifications', hasChildren: true, onClick: () => { this.props.navigateTo(['notifs']) }},
        {name: 'Delete me', hasChildren: true, onClick: () => { this.props.navigateTo(['delete-me']) }},
        {name: 'About', hasChildren: true, onClick: () => { this.props.navigateTo(['about']) }}
      ]
    }

    if (__DEV__) {
      this.state.menuItems.push({
        name: 'Dev Menu',
        hasChildren: true,
        onClick: () => this.props.navigateTo(['devMenu'])
      })
    }
  }

  render () {
    return <MenuList items={this.state.menuItems} />
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'More'},
      subRoutes: {about, account, billing, appPrefs, invites, notifs, deleteMe, devMenu}
    }
  }
}

More.propTypes = {
  navigateTo: React.PropTypes.func.isRequired
}

export default connect(
  null,
  dispatch => {
    return {
      navigateTo: uri => dispatch(navigateTo(uri))
    }
  }
)(More)
