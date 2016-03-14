// @flow
import React from 'react'
import {Text} from '../../../common-adapters'
import Container from '../../forms/container.desktop'
import type {Props} from './index.render'
import {errorMap} from '../../../engine/errors'
import openURL from '../../../util/open-url'

const renderError = error => {
  switch (error.code) {
    case errorMap['scdevicenoprovision']:
      return <Text type='Body'>{`The only way to provision this device is with access to one of your existing
      devices. You can try again later, or if you have lost access to all your
      existing devices you can reset your account and start fresh.

      If you'd like to reset your account:  https://keybase.io/#account-reset`}</Text>
    case errorMap['scdeviceprevprovisioned']:
      return <Text type='Body'>You have already provisioned this device. Please use 'keybase login [username]' to log in.</Text>
    case errorMap['sckeynomatchinggpg']:
      return (
        <p>
          <Text type='Body' style={{display: 'inline-block', marginBottom: 10}}>Sorry, your account is already established with a PGP public key, but we can't find the corresponding private key on this machine. These are the fingerprints of the PGP keys in your account:</Text>
          {error.raw && error.raw.fields && error.raw.fields.map(f => <Text type='BodySmall' style={{display: 'inline-block'}}>{f.value}</Text>)}
          <Text type='Body' style={{display: 'inline-block', marginTop: 10, marginBottom: 10}}>You need to prove you're you. We suggest one of the following:</Text>
          <Text type='BodySmall' style={{display: 'inline-block'}}> - Put one of the PGP private keys listed above on this machine and try again</Text>
          <Text type='BodySmall' style={{display: 'inline-block'}}> - Reset your account and start fresh: </Text><Text type='BodyPrimaryLink' onClick={() => openURL('https://keybase.io/#account-reset')}>https://keybase.io/#account-reset</Text>
        </p>)
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
    marginBottom: 20
  }
}

export default Render
