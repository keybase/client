import React, {Component, View, Text, TextInput} from '../../../base-react'
import commonStyles from '../../../styles/common'
import Button from '../../../common-adapters/button'

export default class SetPublicNameRender extends Component {
  render () {
    return (
      <View style={{flex: 1, padding: 20}}>
        <Text style={commonStyles.h1}>Set a public name for this device</Text>
        <Text style={[commonStyles.h2, {marginTop: 10}]}>We need this because lorem iplorem iplorem iplorem iplorem ipssssslorem ips</Text>
        <TextInput
          style={[commonStyles.textInput, {marginTop: 10}]}
          placeholder='Device nickname'
          value={this.props.deviceName}
          enablesReturnKeyAutomatically
          returnKeyType='next'
          autoCorrect={false}
          onChangeText={deviceName => this.props.onChangeDeviceName(deviceName)}
          onSubmitEditing={() => { this.props.onSubmit() }}
          />

        { this.props.nameTaken &&
          <Text>{`The device name: ${this.props.deviceName} is already taken`}</Text>
        }
        <Button style={{alignSelf: 'flex-end'}} isAction title='Submit' onPress={() => this.props.onSubmit()} enabled={this.props.submitEnabled}/>
      </View>
    )
  }
}

SetPublicNameRender.propTypes = {
  deviceName: React.PropTypes.string,
  onSubmit: React.PropTypes.func.isRequired,
  onChangeDeviceName: React.PropTypes.func.isRequired,
  nameTaken: React.PropTypes.func.isRequired,
  submitEnabled: React.PropTypes.func.isRequired
}
