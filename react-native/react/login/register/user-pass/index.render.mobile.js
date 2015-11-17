import React, {Component, StyleSheet, Text, TextInput, View} from '../../../base-react'
import Button from '../../../common-adapters/button'
import commonStyles from '../../../styles/common'

export default class UserPassRender extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text style={commonStyles.h1}>{this.props.title}</Text>
        <Text style={commonStyles.h2}>{this.props.subTitle}</Text>
        <TextInput style={[commonStyles.textInput, {marginTop: 20}]}
          placeholder='Keybase Username'
          autoCorrect={false}
          enablesReturnKeyAutomatically
          onChangeText={username => this.props.onChangeUsername(username)}
          onSubmitEditing={event => this.refs['passphrase'].focus()}
          returnKeyType='next'
          value={this.props.username}
        />
        <TextInput style={[commonStyles.textInput]}
          autoCorrect={false}
          enablesReturnKeyAutomatically
          onChangeText={passphrase => this.props.onChangePassphrase(passphrase)}
          onSubmitEditing={() => this.props.onSubmit() }
          ref='passphrase'
          returnKeyType='done'
          secureTextEntry
          value={this.props.passphrase}
          placeholder='Keybase Passphrase'
        />

        {this.props.error && (
          <Text>{this.props.error.toString()}</Text>
        )}

        <Button style={{alignSelf: 'flex-end', marginTop: 20}} buttonStyle={commonStyles.actionButton} onPress={() => this.props.onSubmit()} enabled={this.props.buttonEnabled} title='Submit'/>
      </View>
    )
  }
}

UserPassRender.propTypes = {
  onChangeUsername: React.PropTypes.func.isRequired,
  onChangePassphrase: React.PropTypes.func.isRequired,
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string,
  error: React.PropTypes.object,
  onSubmit: React.PropTypes.func.isRequired,
  title: React.PropTypes.string,
  subTitle: React.PropTypes.string,
  buttonEnabled: React.PropTypes.bool.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingTop: 100,
    padding: 20
  }
})
