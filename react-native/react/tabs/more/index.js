'use strict'

import React, { Component, ListView, StyleSheet, View, Text } from 'react-native'
import commonStyles from '../../styles/common'
import Button from '../../common-adapters/button'
import { logout } from '../../actions/login2'
import { pushNewSearch } from '../../actions/search'
import { navigateTo } from '../../actions/router'
import { pushNewProfile } from '../../actions/profile'

export default class More extends Component {
  constructor (props) {
    super(props)
  }

  componentWillMount () {
    const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})

    this.state = {
      dataSource: ds.cloneWithRows([
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
        {name: 'Flow Routing Demo', hasChildren: true, onClick: () => {
          this.props.navigateTo(['flowRoute'])
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
      ])
    }
  }

  renderRow (rowData, sectionID, rowID) {
    const sep = (rowID < (this.state.dataSource.getRowCount() - 1)) ? <View style={commonStyles.separator} /> : null

    return (
      <Button onPress={rowData.onClick}>
        <View>
          <View style={{margin: 10, flexDirection: 'row', flex: 1, justifyContent: 'space-between'}}>
            <Text>{rowData.name}</Text>
            <Text>{rowData.hasChildren ? '>' : ''}</Text>
          </View>
          {sep}
        </View>
      </Button>
    )
  }

  render () {
    return (
      <View style={styles.container}>
        <ListView
        dataSource={this.state.dataSource}
        renderRow={(...args) => { return this.renderRow(...args) }}
        />
      </View>
    )
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
        about: require('./about'),
        developer: require('./developer'),
        navDebug: require('../../debug/nav-debug'),
        bridging: require('../../debug/bridging-tabs'),
        login: require('../../login'),
        flowRoute: require('./flow-route'),
        login2: require('../../login2')
      }
    }
  }
}

More.propTypes = {
  navigateTo: React.PropTypes.func.isRequired,
  logout: React.PropTypes.func.isRequired,
  pushNewSearch: React.PropTypes.func.isRequired,
  pushNewProfile: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  }
})
