// @flow
import Container from '../../forms/container'
import * as React from 'react'
import openURL from '../../../util/open-url'
import {RPCError} from '../../../util/errors'
import {constantsStatusCode} from '../../../constants/types/rpc-gen'
import {Box, Text, Markdown} from '../../../common-adapters'
import {globalStyles, globalMargins, isMobile, platformStyles} from '../../../styles'

import type {Props} from '.'

const renderError = (error: RPCError) => {
  const fields = (Array.isArray(error.fields) ? error.fields : []).reduce((acc, f) => {
    const k = f && typeof f.key === 'string' ? f.key : ''
    acc[k] = f.value || ''
    return acc
  }, {})
  switch (error.code) {
    case constantsStatusCode.scdeviceprovisionoffline:
      return (
        <Text type="Body">
          Device provisioning failed because this device went offline. Please check your network connection
          and try again.
        </Text>
      )
    case constantsStatusCode.scdevicenoprovision:
      return (
        <Box style={styleContent}>
          <Box style={styleText}>
            <Text type="Body" style={centerText}>
              You can't authorize by passphrase, since you have established device or paper keys. You can go
              back and pick a device or paper key, or{' '}
              <Text type="BodyPrimaryLink" onClick={() => openURL('https://keybase.io/#account-reset')}>
                reset your account entirely
              </Text>
              .
            </Text>
          </Box>
        </Box>
      )
    case constantsStatusCode.scdeviceprevprovisioned:
      return (
        <Text type="Body">
          You have already provisioned this device. Please use 'keybase login [username]' to log in.
        </Text>
      )
    case constantsStatusCode.sckeynomatchinggpg:
      if (fields.has_active_device) {
        return (
          <Box style={styleContent}>
            <Box style={styleText}>
              <Text type="Body">
                You can't provision using solely a passphrase, since you have active device keys.
              </Text>
            </Box>
            <Box style={{...styleText, marginTop: 16}}>
              <Text type="BodySemibold" style={{textAlign: 'left'}}>
                You have options:
              </Text>
            </Box>
            <Box style={{styleList}}>
              <Text type="Body"> - Go back and select a device or paper key</Text>
              <Text type="Body"> - Install Keybase on a machine that has your PGP private key in it</Text>
              <Text type="Body">
                {' '}
                - Login to the website and host an encrypted copy of your PGP private key
              </Text>
              <Text type="Body">
                {' '}
                - or,{' '}
                <Text type="BodyPrimaryLink" onClick={() => openURL('https://keybase.io/#account-reset')}>
                  reset your account entirely
                </Text>
                .
              </Text>
            </Box>
          </Box>
        )
      } else {
        return (
          <Box style={styleContent}>
            <Box style={styleText}>
              <Text type="Body">
                You can't provision using a passphrase, since you've established a PGP key.
              </Text>
            </Box>
            <Box style={{...styleText, marginTop: 16}}>
              <Text type="BodySemibold" style={{textAlign: 'left'}}>
                You have options:
              </Text>
            </Box>
            <Box style={styleList}>
              <Text type="Body">
                {' '}
                - Use <Text type="TerminalInline">keybase login</Text> on the command line to log in
              </Text>
              {!isMobile && (
                <Text type="Body">
                  {' '}
                  - Install GPG on this machine and import your PGP private key into it
                </Text>
              )}
              <Text type="Body"> - Install Keybase on a different machine that has your PGP key</Text>
              <Text type="Body">
                {' '}
                - Login to the website and host an encrypted copy of your PGP private key
              </Text>
              <Text type="Body">
                {' '}
                - Or,{' '}
                <Text type="BodyPrimaryLink" onClick={() => openURL('https://keybase.io/#account-reset')}>
                  reset your account entirely
                </Text>
                .
              </Text>
            </Box>
          </Box>
        )
      }
    case constantsStatusCode.sckeynotfound:
      return (
        <Box style={styleContent}>
          {error.desc ? (
            <Markdown>{error.desc}</Markdown>
          ) : (
            <Box style={styleText}>
              <Text type="Body" style={centerText}>
                Your PGP keychain has multiple keys installed, and we're not sure which one to use to
                provision your account. Please run <Text type="TerminalInline">keybase login</Text> on the
                command line to continue.
              </Text>
            </Box>
          )}
        </Box>
      )
    case constantsStatusCode.scnotfound:
      return (
        <Box style={styleContent}>
          <Box style={styleText}>
            <Text type="Body" style={centerText}>
              The username you provided doesn't exist on Keybase, please try logging in again with a different
              username.
            </Text>
          </Box>
        </Box>
      )
    case constantsStatusCode.scbadloginpassword:
      return (
        <Box style={styleContent}>
          <Box style={{...globalStyles.flexBoxColumn, ...styleText}}>
            <Text type="Body">Looks like that's a bad passphrase.</Text>
            <Text
              type="BodyPrimaryLink"
              onClick={() => openURL('https://keybase.io/#password-reset')}
              style={centerText}
            >
              Reset your passphrase?
            </Text>
          </Box>
        </Box>
      )
    case constantsStatusCode.sckeysyncedpgpnotfound:
    case constantsStatusCode.scgpgunavailable:
    case constantsStatusCode.sckeynosecret:
      return (
        <Box style={styleContent}>
          <Box style={styleText}>
            <Text type="Body" style={centerText}>
              Sorry, your account is already established with a PGP public key, but we can't access the
              corresponding private key.
            </Text>
          </Box>
          <Box style={{...styleText, marginTop: 16}}>
            <Text type="BodySemibold" style={{textAlign: 'left'}}>
              You have options:
            </Text>
          </Box>
          <Box style={styleList}>
            <Text type="Body">
              {' '}
              - Run <Text type="TerminalInline">keybase login</Text> on the device with the corresponding PGP
              private key
            </Text>
            {!isMobile && (
              <Text type="Body"> - Install GPG, put your PGP private key on this machine and try again</Text>
            )}
            <Text type="Body"> - Go back and provision with another device or paper key</Text>
            <Text type="Body">
              {' '}
              - Or, if none of the above are possible,{' '}
              <Text type="BodyPrimaryLink" onClick={() => openURL('https://keybase.io/#account-reset')}>
                reset your account and start fresh
              </Text>
            </Text>
          </Box>
        </Box>
      )
    case constantsStatusCode.scinputcanceled:
      return (
        <Box style={styleContent}>
          <Text type="Body">Login Cancelled</Text>
        </Box>
      )
    case constantsStatusCode.sckeycorrupted:
      return (
        <Box style={styleContent}>
          <Text type="Body">{error.message}</Text>
          <Text type="Body">
            {' '}
            We were able to generate a PGP signature but it was rejected by the server. This often means that
            this PGP key is expired or unusable. You can update your key on{' '}
            <Text type="BodyPrimaryLink" onClick={() => openURL('https://keybase.io/')}>
              keybase.io
            </Text>
            .
          </Text>
        </Box>
      )
    default:
      return (
        <Box style={styleContent}>
          <Text style={styleErrorTitle} type="Body" selectable={true}>
            {error.desc}
          </Text>
          <Text type="BodySmall" selectable={true}>
            {error.details}
          </Text>
        </Box>
      )
  }
}

const Render = ({onBack, error}: Props) => (
  <Container onBack={onBack}>
    <Text type="Header" style={styleHeader}>
      There was an error provisioning
    </Text>
    {renderError(error)}
  </Container>
)

const centerText = platformStyles({
  common: {
    textAlign: 'center',
  },
  isElectron: {
    display: 'inline-block',
  },
})

const styleHeader = {
  alignSelf: 'center',
  marginTop: 46,
  marginBottom: 20,
}

const styleText = {
  marginBottom: 10,
  maxWidth: 460,
}

const styleList = {
  ...styleText,
  ...globalStyles.flexBoxColumn,
  marginLeft: globalMargins.tiny,
}

const styleContent = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
}

const styleErrorTitle = {
  marginBottom: globalMargins.tiny,
}

export default Render
