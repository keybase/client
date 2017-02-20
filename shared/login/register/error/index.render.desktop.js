// @flow
import Container from '../../forms/container.desktop'
import React from 'react'
import openURL from '../../../util/open-url'
import type {Props} from './index.render'
import {RPCError} from '../../../util/errors'
import {ConstantsStatusCode} from '../../../constants/types/flow-types'
import {Text, Markdown} from '../../../common-adapters'

const renderError = (error: RPCError) => {
  const fields = (Array.isArray(error.fields) ? error.fields : []).reduce((acc, f) => {
    const k = f && typeof f.key === 'string' ? f.key : ''
    acc[k] = f.value || ''
    return acc
  }, {})
  switch (error.code) {
    case ConstantsStatusCode.scdevicenoprovision:
      return (
        <div>
          <p style={styleText}><Text type='Body'>Sorry!</Text></p>
          <p style={styleText}><Text type='Body'>You can't authorize by passphrase, since you have established device or paper keys.</Text></p>
          <p style={styleText}><Text type='Body'>What you can do:</Text></p>
          <p style={styleText}><Text type='Body'> - Go back and pick a device or paper key</Text></p>
          <p style={styleText}><Text type='Body'> - Reset your account entirely: </Text><Text type='BodyPrimaryLink' onClick={() => openURL('https://keybase.io/#account-reset')}>https://keybase.io/#account-reset</Text></p>
        </div>)
    case ConstantsStatusCode.scdeviceprevprovisioned:
      return <Text type='Body'>You have already provisioned this device. Please use 'keybase login [username]' to log in.</Text>
    case ConstantsStatusCode.sckeynomatchinggpg:
      if (fields.has_active_device) {
        return (
          <div>
            <p style={styleText}><Text type='Body'>Sorry!</Text></p>
            <p style={styleText}><Text type='Body'>You can't provision using solely a passphrase, since you have active device keys.</Text></p>
            <p>
              <p style={styleText}><Text type='Body'>You have options:</Text></p>
              <p style={styleText}><Text type='Body'> - Go back and select a device or paper key</Text></p>
              <p style={styleText}><Text type='Body'> - Install Keybase on a machine that has your PGP private key in it</Text></p>
              <p style={styleText}><Text type='Body'> - Login to the website and host an encrypted copy of your PGP private key</Text></p>
              <p style={styleText}><Text type='Body'> - or, reset your account entirely: </Text><Text type='BodyPrimaryLink' onClick={() => openURL('https://keybase.io/#account-reset')}>https://keybase.io/#account-reset</Text></p>
            </p>
          </div>)
      } else {
        return (
          <div>
            <p style={styleText}><Text type='Body'>Sorry!</Text></p>
            <p style={styleText}><Text type='Body'>You can't provision using a passphrase, since you've established a PGP key.</Text></p>
            <p style={styleText}><Text type='Body'>You have options:</Text></p>
            <p style={styleText}><Text type='Body'> - Use <Text type='Terminal'>keybase login</Text> on the command line to log in</Text></p>
            <p style={styleText}><Text type='Body'> - Install GPG on this machine and import your PGP private key into it</Text></p>
            <p style={styleText}><Text type='Body'> - Install Keybase on a different machine that has your PGP key</Text></p>
            <p style={styleText}><Text type='Body'> - Login to the website and host an encrypted copy of your PGP private key</Text></p>
            <p style={styleText}><Text type='Body'> - Or, reset your account entirely: </Text><Text type='BodyPrimaryLink' onClick={() => openURL('https://keybase.io/#account-reset')}>https://keybase.io/#account-reset</Text>
            </p>
          </div>)
      }
    case ConstantsStatusCode.sckeynotfound:
      return (
        <p>
          {error.desc ? <Markdown>{error.desc}</Markdown> : (
            <Text type='Body'>Your PGP keychain has multiple keys installed, and we're not sure which one to use to provision your account. Please run <Text type='Terminal'>keybase login</Text> on the command line to continue.</Text>
          )}
        </p>
      )
    case ConstantsStatusCode.scnotfound:
      return (
        <p>
          <Text type='Body'>The username you provided doesn't exist on Keybase, please try logging in again with a different username.</Text>
        </p>
      )
    case ConstantsStatusCode.scbadloginpassword:
      return (
        <p>
          <Text type='Body'>The server rejected your login attempt.  If you'd like to reset your passphrase, go to </Text>
          <Text type='BodyPrimaryLink' onClick={() => openURL('https://keybase.io/#password-reset')}>https://keybase.io/#password-reset</Text>
        </p>)
    case ConstantsStatusCode.sckeysyncedpgpnotfound:
    case ConstantsStatusCode.scgpgunavailable:
    case ConstantsStatusCode.sckeynosecret:
      return (
        <p>
          <p style={styleText}><Text type='Body'>Sorry, your account is already established with a PGP public key, but we can't access the corresponding private key.</Text></p>
          <p style={styleText}><Text type='Body' style={{marginTop: 10, marginBottom: 10}}>You need to prove you're you. We suggest one of the following:</Text></p>
          <p style={styleText}><Text type='Body'> - Use <Text type='Terminal'>keybase login</Text> on the command line to log in</Text></p>
          <p style={styleText}><Text type='Body'> - Install GPG and put your PGP private key on this machine and try again</Text></p>
          <p style={styleText}><Text type='Body'> - Reset your account and start fresh: </Text> <Text type='BodyPrimaryLink' onClick={() => openURL('https://keybase.io/#account-reset')}>https://keybase.io/#account-reset</Text></p>
          <p style={styleText}><Text type='Body'> - Go back and provision with another device or paper key</Text></p>
        </p>)
    default:
      return <Text type='Body'>Unknown error: {error.message}</Text>
  }
}

const Render = ({onBack, error}: Props) => (
  <Container onBack={onBack}>
    <Text type='Header' style={styleHeader}>There was an error provisioning</Text>
    {renderError(error)}
  </Container>
)

const styleHeader = {
  alignSelf: 'center',
  marginTop: 46,
  marginBottom: 20,
}

const styleText = {
  marginBottom: 10,
}
export default Render
