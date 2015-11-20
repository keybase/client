import React, {Component, StyleSheet, Text, View} from '../../base-react'

export default class RegisterRender extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text>Register</Text>
        <Text onPress={() => { this.props.onGotoExistingDevicePage() }}>Use an existing device</Text>
        <Text onPress={() => { this.props.onGotoPaperKeyPage() }}>Use a paper key</Text>
        <Text onPress={() => { this.props.onGotoUserPassPage() }}>Use my keybase passphrase</Text>
      </View>
    )
  }
}

RegisterRender.propTypes = {
  onGotoExistingDevicePage: React.PropTypes.func.isRequired,
  onGotoPaperKeyPage: React.PropTypes.func.isRequired,
  onGotoUserPassPage: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
