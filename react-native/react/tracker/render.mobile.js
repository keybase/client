import React, {Component, View} from '../base-react'

import Header from './header.render'
import Action from './action.render'
import Bio from './bio.render'
import Proofs from './proofs.render'

export default class Render extends Component {
  render () {
    return (
      <View style={{backgroundColor: 'red', display: 'flex', flex: 1, flexDirection: 'column'}}>
        <Header />
        <View style={{backgroundColor: 'green', display: 'flex', flex: 1, flexDirection: 'row', height: 480}}>
          <Bio />
          <Proofs />
        </View>
        <Action />
      </View>
    )
  }
}
