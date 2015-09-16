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
var enums = require('../keybase_v1')

class SelectSigner extends Component {
  constructor () {
    super()
  }

  componentWillMount () {
    var ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2})

    var devices = this.props.devices.map(function (d) {
      var desc = 'Use the device named ' + d.name + ' to authorize this installation'

      return {
        ...d,
        desc: desc
      }
    })

    if (this.props.hasPGP) {
      devices.push({
        name: 'PGP Key',
        desc: 'Use your PGP key'
      })
    }

    this.state = {
      dataSource: ds.cloneWithRows(devices)
    }
  }

  select (rowData) {
    var signer = {
      deviceID: rowData.deviceID,
      deviceName: rowData.name,
      kind: enums.locksmithUi.DeviceSignerKind.device
    }

    if (!rowData.deviceID) {
      signer.kind = enums.locksmithUi.DeviceSignerKind.pgp
    }

    this.props.response.result({
      action: enums.locksmithUi.SelectSignerAction.sign,
      signer: signer
    })
  }

  renderRow (rowData, sectionID, rowID) {
    var sep = (rowID < (this.state.dataSource.getRowCount() - 1)) ? <View style={styles.separator} /> : null
    return (
      <TouchableHighlight
        underlayColor={commonStyles.buttonHighlight}
        onPress={() => { this.select(rowData) }}>
        <View>
          <View style={{margin: 10}}>
            <Text>{rowData.name}</Text>
            <Text style={{fontSize: 10}}>{rowData.desc}</Text>
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
        renderRow={(...args) => { return this.renderRow(...args) }}
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

module.exports = SelectSigner
