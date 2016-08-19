import React, {Component} from 'react'
import {NativeTouchableWithoutFeedback, NativeListView, Box, Text} from '../common-adapters'
import {globalStyles} from '../styles/style-guide'

export default class MenuList extends Component {
  componentWillMount () {
    const ds = new NativeListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})
    this.state = {
      dataSource: ds.cloneWithRows(this.props.items),
    }
  }

  renderRow (rowData, sectionID, rowID) {
    return (
      <NativeTouchableWithoutFeedback onPress={rowData.onClick || (() => {})}>
        <Box style={{margin: 10, ...globalStyles.flexBoxRow, flex: 1}}>
          <Text type='BodySmall'>{rowData.name}</Text>
          <Text type='BodySmall' style={{flex: 1}}>{rowData.hasChildren ? '>' : ''}</Text>
        </Box>
      </NativeTouchableWithoutFeedback>
    )
  }

  render () {
    return (
      <Box style={styles.container}>
        <NativeListView
          dataSource={this.state.dataSource}
          renderRow={(rowData, sectionID, rowID) => { return this.renderRow(rowData, sectionID, rowID) }} />
      </Box>
    )
  }
}

const styles = {
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF',
  },
}
