import React, {Component} from '../base-react'
import {connect} from '../base-redux'
import {navigateTo} from '../actions/router'
import MenuList from './menu-list'
import {isDev} from '../constants/platform'

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

  static parseRoute () {
    return {
      componentAtTop: {title: 'More'},
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

export default connect(
  null,
  dispatch => {
    return {
      navigateTo: uri => dispatch(navigateTo(uri))
    }
  }
)(More)
