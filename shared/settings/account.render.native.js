import React, {Component} from 'react'
import {Button, Text, Input, Box} from '../common-adapters'

// TODO redo this screen with style guide
const commonStyles = {}

export default class AccountRender extends Component {
  constructor (props) {
    super(props)

    this.state = {
      email: this.props.email,
      oldPassphrase: null,
      newPassphrase: null,
      newPassphraseRepeat: null,
    }
  }

  render () {
    const {email, emailVerified, onSave, emailError, passphraseError} = this.props
    return (
      <Box style={styles.container}>
        <Box style={styles.emailContainer}>
          <Text style={styles.verifiedTag}>
            {emailVerified ? 'Verified ✔' : 'Not Verified'}
          </Text>
          <Input style={commonStyles.textInput}
            onChangeText={email => this.setState({email})}
            defaultValue={email} />
          {emailError && <Text style={[styles.errorInfo, {marginHorizontal: 10}]}>{emailError}</Text>}
        </Box>

        <Box style={styles.changePasswordContainer}>
          <Text style={{fontSize: 23, marginBottom: 20}}> Change Passphrase </Text>
          <Input style={commonStyles.textInput}
            returnKeyType='next'
            onSubmitEditing={() => this.refs['newPassphrase'].focus()}
            onChangeText={oldPassphrase => this.setState({oldPassphrase})}
            placeholder='Current passphrase' />
          <Input style={commonStyles.textInput}
            returnKeyType='next'
            ref='newPassphrase'
            onSubmitEditing={() => this.refs['newPassphraseRepeat'].focus()}
            onChangeText={newPassphrase => this.setState({newPassphrase})}
            placeholder='New passphrase' />
          <Input style={commonStyles.textInput}
            returnKeyType='next'
            ref='newPassphraseRepeat'
            onChangeText={newPassphraseRepeat => this.setState({newPassphraseRepeat})}
            placeholder='Confirm new passphrase' />

          <Box style={styles.saveContainer}>
            {passphraseError && <Text style={styles.errorInfo}>{passphraseError}</Text>}
            <Box style={{flex: 1}}>
              <Button
                buttonStyle={commonStyles.button}
                style={styles.saveButton}
                title='Save'
                type='Secondary'
                onClick={() => {
                  const {email, oldPassphrase, newPassphrase, newPassphraseRepeat} = this.state
                  onSave(email, oldPassphrase, newPassphrase, newPassphraseRepeat)
                }} />
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }
}

const styles = {
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emailContainer: {
    flex: 0,
    marginBottom: 50,
    flexDirection: 'column',
  },
  changePasswordContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  verifiedTag: {
    fontSize: 13,
    textAlign: 'right',
  },
  saveContainer: {
    flex: 0,
    marginTop: 14,
    marginHorizontal: 10,
    alignItems: 'center',
    flexDirection: 'row',
  },
  errorInfo: {
    color: 'red',
  },
  saveButton: {
    width: 80,
    alignSelf: 'flex-end',
  },
}
