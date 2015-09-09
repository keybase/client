'use strict'

var React = require('react-native')
var {
  Component,
  ListView,
  StyleSheet,
  View,
  Text,
  TouchableHighlight
} = React

var commonStyles = require('../styles/common')

var styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  },
  separator: {
    height: 1,
    backgroundColor: '#CCCCCC'
  }
})

class SelectSigner extends Component {
  constructor () {
    super()
  }

  componentWillMount () {
    var ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})

    this.state = {
      dataSource: ds.cloneWithRows(this.props.devices)
    }
  }

  select (rowData) {
    // {"action":0,"signer":{"kind":0,"deviceID":"e0ce327507bf30e8f7a2512a72bdd318","deviceName":"b"}}
    /*
  KBRDeviceSignerKindDevice = 0,
	KBRDeviceSignerKindPgp = 1,
	KBRDeviceSignerKindPaperBackupKey = 2,
  */
 // TODO generate this from the protocol

    this.props.response.result({
      action: 0, // sign
      signer: {
        kind: 0,
        deviceID: rowData.deviceID,
        deviceName: rowData.name
      }
    })
  }

  renderRow (rowData, sectionID, rowID) {
    var sep = (rowID < (this.state.dataSource.getRowCount() - 1)) ? <View style={styles.separator} /> : null
    return (
      <TouchableHighlight
        underlayColor={commonStyles.buttonHighlight}
        onPress={() => {this.select(rowData)}}>
        <View>
          <View style={{margin: 10}}>
            <Text>{rowData.name}</Text>
            <Text style={{fontSize: 10}}>{rowData.type + ' with id ' + rowData.deviceID}</Text>
          </View>
          {sep}
        </View>
      </TouchableHighlight>
    )
  }

  render () {
    return (
      <View style={styles.container}>
        <ListView style={{}}
        dataSource={this.state.dataSource}
        renderRow={(...args) => {return this.renderRow(...args)}}
        renderSectionHeader={() => {
          return <Text style={{margin: 10}}>This is the first time you've logged into this computer. You need to setup and verify this installation of Keybase. Which method do you want to use?</Text>
        }}
        />
      </View>
    )
  }
}

SelectSigner.propTypes = {
  navigator: React.PropTypes.object,
  devices: React.PropTypes.array,
  hasPGP: React.PropTypes.bool,
  hasPaperBackupKey: React.PropTypes.bool,
  response: React.PropTypes.object

}

module.exports = SelectSigner
