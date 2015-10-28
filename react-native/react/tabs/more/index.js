'use strict'

import React, { Component, StyleSheet, View } from 'react-native'
import { navigateTo } from '../../actions/router'
import MenuList from './menu-list'
import { isDev } from '../../constants/platform'

export default class More extends Component {
  render () {
    // TODO: actually get this data
    const dummyInvitationCount = 3
    const menuItems = [
      {name: 'Account', hasChildren: true, onClick: () => {
        this.props.navigateTo(['account'])
      }},
      {name: 'Billing Settings', hasChildren: true, onClick: () => {
        this.props.navigateTo(['billing'])
      }},
      {name: 'App Preferences', hasChildren: true, onClick: () => {
        this.props.navigateTo(['appPrefs'])
      }},
      {name: `Invitations (${dummyInvitationCount})`, hasChildren: true, onClick: () => {
        this.props.navigateTo(['invites'])
      }},
      {name: 'Notifications', hasChildren: true, onClick: () => {
        this.props.navigateTo(['notifs'])
      }},
      {name: 'Delete me', hasChildren: true, onClick: () => {
        this.props.navigateTo(['deleteMe'])
      }},

      {name: 'About', hasChildren: true, onClick: () => {
        this.props.navigateTo(['about'])
      }}
    ]

    if (isDev) {
      menuItems.push({
        name: 'Dev Menu',
        hasChildren: true,
        onClick: () => this.props.navigateTo(['devMenu'])
      })
    }

    return (
      <View style={styles.container}>
        <MenuList menuItems={menuItems} />
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'More',
        mapStateToProps: state => { return {} },
        props: {
          navigateTo: uri => store.dispatch(navigateTo(uri))
        }
      },
      subRoutes: {
        about: require('./about'),
        account: require('./account'),
        billing: require('./billing'),
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

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
})
