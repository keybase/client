'use strict'
/* @flow */

import React from 'react-native'
import {
  Component,
  Image,
  StyleSheet,
  ScrollView,
  Text,
  View
} from 'react-native'

class Profile extends Component {
  constructor (props) {
    super(props)

    this.state = {
    }
  }

  render () {
    return (
      <ScrollView style={styles.container}>
        <View style={{justifyContent: 'center', alignItems: 'center'}}>
          <Image style={{width: 100, height: 100}} source={{uri: this.props.avatar}}/>
          <Text>{this.props.username}</Text>
          <Text>keybase.io/{this.props.username}</Text>
          { this.props.proofs.map((details, proof) => {
            return (<Text>{proof}: {details.get('display')}{details.get('warning')}{details.get('error')} </Text>)
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
        mapStateToProps: state => state.profile.get(username).toObject()
      },
      parseNextRoute: null
    }
  }
}

Profile.propTypes = {
  waitingForServer: React.PropTypes.bool.isRequired,
  username: React.PropTypes.string,
  proofs: React.PropTypes.array,
  avatar: React.PropTypes.string
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
