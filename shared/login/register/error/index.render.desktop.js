// @flow
import React from 'react'
import {Text} from '../../../common-adapters'
import Container from '../../forms/container.desktop'
import type {Props} from './index.render'
import {errorMap} from '../../../engine/errors'
import openURL from '../../../util/open-url'

const renderError = error => {
  const fields = (error.raw && error.raw.fields || []).reduce((acc, f) => {
    acc[f.key] = f.value
    return acc
  }, {})
  switch (error.code) {
    case errorMap['scdevicenoprovision']:
      return (
        <div>
          <p style={{marginBottom: 10}}><Text type='Body'>Sorry!</Text></p>
          <p style={{marginBottom: 10}}><Text type='Body' inline={false}>You can’t authorize by passphrase, since you have established device or paper keys.</Text></p>
          <p>
            <Text type='Body' inline={false}>What you can do:</Text>
            <Text type='Body' inline={false}> - Go back and pick a device or paper key</Text>
            <Text type='Body'> - Reset your account entirely: </Text><Text type='BodyPrimaryLink' onClick={() => openURL('https://keybase.io/#account-reset')}>https://keybase.io/#account-reset</Text>
          </p>
        </div>)
    case errorMap['scdeviceprevprovisioned']:
      return <Text type='Body'>You have already provisioned this device. Please use 'keybase login [username]' to log in.</Text>
    case errorMap['sckeynomatchinggpg']:
      if (fields.has_active_device) {
        return (
          <div>
            <p style={{marginBottom: 10}}><Text type='Body'>Sorry!</Text></p>
            <p style={{marginBottom: 10}}><Text type='Body' inline={false}>You can’t provision using solely a passphrase, since you have active device keys.</Text></p>
            <p>
              <Text type='Body' inline={false}>You have options:</Text>
              <Text type='Body' inline={false}> - Go back and select a device or paper key</Text>
              <Text type='Body' inline={false}> - Install Keybase on a machine that has your PGP private key in it</Text>
              <Text type='Body' inline={false}> - Login to the website and host an encrypted copy of your PGP private key</Text>
              <Text type='Body'> - or, reset your account entirely: </Text><Text type='BodyPrimaryLink' onClick={() => openURL('https://keybase.io/#account-reset')}>https://keybase.io/#account-reset</Text>
            </p>
          </div>)
      } else {
        return (
          <div>
            <p style={{marginBottom: 10}}><Text type='Body'>Sorry!</Text></p>
            <p style={{marginBottom: 10}}><Text type='Body' inline={false}>You can’t provision using a passphrase, since you’ve established a PGP key.</Text></p>
            <p>
              <Text type='Body' inline={false}>You have options:</Text>
              <Text type='Body' inline={false}> - Install GPG on this machine and import your PGP private key into it</Text>
              <Text type='Body' inline={false}> - Install Keybase on a different machine that has your PGP key</Text>
              <Text type='Body' inline={false}> - Login to the website and host an encrypted copy of your PGP private key</Text>
              <Text type='Body'> - Or, reset your account entirely: </Text><Text type='BodyPrimaryLink' onClick={() => openURL('https://keybase.io/#account-reset')}>https://keybase.io/#account-reset</Text>
            </p>
          </div>)
      }
    case errorMap['scbadloginpassword']:
      return (
        <p>
          <Text type='Body'>The server rejected your login attempt.  If you'd like to reset your passphrase, go to </Text>
          <Text type='BodyPrimaryLink' onClick={() => openURL('https://keybase.io/#password-reset')}>https://keybase.io/#password-reset</Text>
        </p>)
    case errorMap['sckeysyncedpgpnotfound']:
      return (
        <p>
          <Text type='Body'>Sorry, your account is already established with a PGP public key, but this we can't access the corresponding private key. </Text>
          <Text type='Body' style={{display: 'inline-block', marginTop: 10, marginBottom: 10}}>You need to prove you're you. We suggest one of the following:</Text>
          <Text type='BodySmall' style={{display: 'inline-block'}}> - Install GPG and put your PGP private key on this machine and try again</Text>
          <Text type='BodySmall' style={{display: 'inline-block'}}> - Reset your account and start fresh: </Text>
          <Text type='BodyPrimaryLink' onClick={() => openURL('https://keybase.io/#account-reset')}>https://keybase.io/#account-reset</Text>
          <Text type='BodySmall' style={{display: 'inline-block'}}> - Go back and provision with another device or paper key</Text>
        </p>)
    default:
      return <Text type='Body'>Unknown error: {error.toString()}</Text>
  }
}

const Render = ({onBack, error}: Props) => (
  <Container
    style={styles.container}
    onBack={onBack}>
    <Text type='Header' style={styles.header}>There was an error provisioning</Text>
    {renderError(error)}
  </Container>
)

const styles = {
  container: {},
  header: {
    alignSelf: 'center',
    marginTop: 46,
    marginBottom: 20,
  },
}

export default Render
