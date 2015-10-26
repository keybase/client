'use strict'

import React, { Component, StyleSheet, View } from 'react-native'
import { navigateTo } from '../../actions/router'
import { pushNewProfile } from '../../actions/profile'
import { pushNewSearch } from '../../actions/search'
import { logout } from '../../actions/login2'
import MenuList from './menu-list'

export default class DevMenu extends Component {
  render () {
    const menuItems = [
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
    return (
      <View style={styles.container}>
        <MenuList menuItems={menuItems} />
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Dev Menu',
        mapStateToProps: state => { return {} },
        props: {
          navigateTo: uri => store.dispatch(navigateTo(uri)),
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
  navigateTo: React.PropTypes.func.isRequired,
  logout: React.PropTypes.func.isRequired,
  pushNewSearch: React.PropTypes.func.isRequired,
  pushNewProfile: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
})
