import React, {Component, Text, View} from 'react'
import commonStyles from '../../styles/common'
import Button from '../../common-adapters/button'

export default class RemoveDeviceRender extends Component {
  render () {
    return (
      <View style={{flex: 1, padding: 20}}>
        <Text style={commonStyles.h1}>Remove "{this.props.deviceName}"?</Text>
        <Text style={[commonStyles.h2, {marginTop: 20}]}>Removing this account will, lorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsum lorem ipsum lorem ipsum </Text>
        <View style={{flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', marginTop: 20}}>
          <Button type='Secondary' style={{marginRight: 20}} title='Cancel' onPress={() => this.props.onCancel()} />
          <Button type='Secondary' style={{}} title='Delete' onPress={() => this.props.onSubmit()} />
        </View>
      </View>
    )
  }
}

RemoveDeviceRender.propTypes = {
  deviceName: React.PropTypes.string.isRequired,
  onCancel: React.PropTypes.func.isRequired,
  onSubmit: React.PropTypes.func.isRequired,
}
