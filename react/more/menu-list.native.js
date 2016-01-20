import React, {Component, View, ListView, Text, StyleSheet} from '../base-react'
import Button from '../common-adapters/button'
import commonStyles from '../styles/common'

export default class MenuList extends Component {
  componentWillMount () {
    const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})
    this.state = {
      dataSource: ds.cloneWithRows(this.props.items)
    }
  }

  renderSep (rowID) {
    return (rowID < (this.state.dataSource.getRowCount() - 1)) ? <View style={commonStyles.separator} /> : null
  }

  renderRow (rowData, sectionID, rowID) {
    const sep = this.renderSep(rowID)

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
        renderRow={(rowData, sectionID, rowID) => { return this.renderRow(rowData, sectionID, rowID) }}/>
      </View>
    )
  }
}

MenuList.propTypes = {
  items: React.PropTypes.arrayOf(React.PropTypes.shape({
    name: React.PropTypes.string.isRequired,
    hasChildren: React.PropTypes.bool,
    onClick: React.PropTypes.func.isRequired
  }))
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  }
})
