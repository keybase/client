'use strict'
/* @flow */

import React from 'react-native'
import {
  ActivityIndicatorIOS,
  Component,
  StyleSheet,
  Text,
  TextInput,
  TouchableHighlight,
  View
} from 'react-native'

import { getCurrentRoute } from '../actions/router'
import * as ProfileActions from '../actions/profile'
import commonStyles from '../styles/common'

class Profile extends Component {
  constructor (props) {
    super(props)

    this.state = {
    }
  }

  render () {
    return (
      <View style={styles.container}>
        <Text>this.props</Text>
      </View>
    )
  }

  static canParseNextRoute (currentPath) {
    return currentPath.get('path') === 'profile'
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        component: Profile,
        mapStateToProps: (state) => {
          return state
          /*
          console.log('in profile')
          console.log(state)
          console.log(state.profile[currentPath.get('username')])
          console.log(JSON.stringify(state.profile))
          return state.profile[currentPath.get('username')]
          // TEMP
          */
        }
      },
      parseNextRoute: null
    }
  }
}

Profile.propTypes = {
  kbNavigator: React.PropTypes.object,
  dispatch: React.PropTypes.func.isRequired,
  results: React.PropTypes.array,
  waitingForServer: React.PropTypes.bool.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  },
  input: {
    height: 40,
    marginBottom: 5,
    marginLeft: 10,
    marginRight: 10,
    borderWidth: 0.5,
    borderColor: '#0f0f0f',
    fontSize: 13,
    padding: 4
  },
  submitWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  }
})

export default Profile
