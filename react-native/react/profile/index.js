'use strict'
/* @flow */

import React from 'react-native'
import {
  ActivityIndicatorIOS,
  Component,
  StyleSheet,
  ScrollView,
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
      <ScrollView style={styles.container}>
        <View>
          <Text>{this.props.username}</Text>
          <Text>keybase.io/{this.props.username}</Text>
          { Object.keys(this.props.proofs).map(proof => {
            const {proofs: {[proof]: details}} = this.props
            return (<Text>{proof}: {details.display} </Text>)
          }) }
          { /* (<Text>{JSON.stringify(this.props, null, 4)}</Text>) */ }
        </View>
      </ScrollView>
    )
  }

  static canParseNextRoute (currentPath) {
    return currentPath.get('path') === 'profile'
  }

  static parseRoute (store, currentPath, nextPath) {
    const username = currentPath.get('username')
    return {
      componentAtTop: {
        component: Profile,
        mapStateToProps: state => state.profile[username]
      },
      parseNextRoute: null
    }
  }
}

Profile.propTypes = {
  waitingForServer: React.PropTypes.bool.isRequired,
  username: React.PropTypes.string,
  proofs: React.PropTypes.array
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FCFF',
    marginTop: 64
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
