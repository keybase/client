'use strict'

import React from '../base-react'
import BaseComponent from '../base-component'
import { View, ListView, Text, StyleSheet } from 'react-native'
import Button from '../common-adapters/button'
import commonStyles from '../styles/common'

export default class More extends BaseComponent {
  constructor (props) {
    super(props)
  }

  componentWillMount () {
    const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})
    this.state = {
      dataSource: ds.cloneWithRows(this.props.items)
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  }
})
