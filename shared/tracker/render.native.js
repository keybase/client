import React, {Component} from 'react'
import {View} from 'react-native'

import Header from './header.render'
import {UserBio, UserProofs} from '../common-adapters'
import Action from './action.render'

export default class Render extends Component {
  render () {
    return (
      <View style={{backgroundColor: 'red', display: 'flex', flex: 1, flexDirection: 'column'}}>
        <Header />
        <View style={{backgroundColor: 'green', display: 'flex', flex: 1, flexDirection: 'row', height: 480}}>
          <UserBio />
          <UserProofs />
        </View>
        <Action />
      </View>
    )
  }
}
