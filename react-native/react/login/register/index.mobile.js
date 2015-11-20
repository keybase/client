import React, {Component, StyleSheet, Text, View} from '../../base-react'
import {connect} from '../../base-redux'
import {registerWithUserPass, registerWithPaperKey, registerWithExistingDevice} from '../../actions/login'

class Register extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text>Register</Text>
        <Text onPress={() => { this.props.gotoExistingDevicePage() }}>Use an existing device</Text>
        <Text onPress={() => { this.props.gotoPaperKeyPage() }}>Use a paper key</Text>
        <Text onPress={() => { this.props.gotoUserPassPage() }}>Use my keybase passphrase</Text>
      </View>
    )
  }

  static parseRoute () {
    return {componentAtTop: {}}
  }
}

Register.propTypes = {
  gotoExistingDevicePage: React.PropTypes.func.isRequired,
  gotoPaperKeyPage: React.PropTypes.func.isRequired,
  gotoUserPassPage: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

export default connect(
  null,
  dispatch => {
    return {
      gotoExistingDevicePage: () => dispatch(registerWithExistingDevice()),
      gotoPaperKeyPage: () => dispatch(registerWithPaperKey()),
      gotoUserPassPage: () => dispatch(registerWithUserPass())
    }
  }
)(Register)
