// @flow
import Container from '../../forms/container'
import React from 'react'
import openURL from '../../../util/open-url'
import {RPCError} from '../../../util/errors'
import {ConstantsStatusCode} from '../../../constants/types/flow-types'
import {Box, Text, Markdown} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'

import type {Props} from './index.render'

const renderError = (error: RPCError) => {
  const fields = (Array.isArray(error.fields)
    ? error.fields
    : []).reduce((acc, f) => {
    const k = f && typeof f.key === 'string' ? f.key : ''
    acc[k] = f.value || ''
    return acc
  }, {})
  switch (error.code) {
    case ConstantsStatusCode.scdevicenoprovision:
      return (
        <Box style={styleContent}>
          <Box style={styleText}>
            <Text type="Body">
              You can't authorize by passphrase, since you have established device or paper keys. You can go back and pick a device or paper key, or
              {' '}
              <Text
                type="BodyPrimaryLink"
                onClick={() => openURL('https://keybase.io/#account-reset')}
              >
                reset your account entirely
              </Text>
              .
            </Text>
          </Box>
        </Box>
      )
    case ConstantsStatusCode.scdeviceprevprovisioned:
      return (
        <Text type="Body">
          You have already provisioned this device. Please use 'keybase login [username]' to log in.
        </Text>
      )
    case ConstantsStatusCode.sckeynomatchinggpg:
      if (fields.has_active_device) {
        return (
          <Box style={styleContent}>
            <Box style={styleText}>
              <Text type="Body">
                You can't provision using solely a passphrase, since you have active device keys.
              </Text>
            </Box>
            <Box style={{...styleText, textAlign: 'left', marginTop: 16}}>
              <Text type="BodySemibold">You have options:</Text>
            </Box>
            <Box style={{styleList}}>
              <Text type="Body">
                {' '}- Go back and select a device or paper key
              </Text>
              <Text type="Body">
                {' '}
                - Install Keybase on a machine that has your PGP private key in it
              </Text>
              <Text type="Body">
                {' '}
                - Login to the website and host an encrypted copy of your PGP private key
              </Text>
              <Text type="Body">
                {' '}
                - or,
                {' '}
                <Text
                  type="BodyPrimaryLink"
                  onClick={() => openURL('https://keybase.io/#account-reset')}
                >
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
            <Box style={{...styleText, textAlign: 'left', marginTop: 16}}>
              <Text type="BodySemibold">You have options:</Text>
            </Box>
            <Box style={styleList}>
              <Text type="Body">
                {' '}
                - Use
                {' '}
                <Text type="TerminalInline">keybase login</Text>
                {' '}
                on the command line to log in
              </Text>
              {!isMobile &&
                <Text type="Body">
                  {' '}
                  - Install GPG on this machine and import your PGP private key into it
                </Text>}
              <Text type="Body">
                {' '}
                - Install Keybase on a different machine that has your PGP key
              </Text>
              <Text type="Body">
                {' '}
                - Login to the website and host an encrypted copy of your PGP private key
              </Text>
              <Text type="Body">
                {' '}
                - Or,
                {' '}
                <Text
                  type="BodyPrimaryLink"
                  onClick={() => openURL('https://keybase.io/#account-reset')}
                >
                  reset your account entirely
                </Text>
                .
              </Text>
            </Box>
          </Box>
        )
      }
    case ConstantsStatusCode.sckeynotfound:
      return (
        <Box style={styleContent}>
          {error.desc
            ? <Markdown>{error.desc}</Markdown>
            : <Box style={styleText}>
                <Text type="Body">
                  Your PGP keychain has multiple keys installed, and we're not sure which one to use to provision your account. Please run
                  {' '}
                  <Text type="TerminalInline">keybase login</Text>
                  {' '}
                  on the command line to continue.
                </Text>
              </Box>}
        </Box>
      )
    case ConstantsStatusCode.scnotfound:
      return (
        <Box style={styleContent}>
          <Box style={styleText}>
            <Text type="Body">
              The username you provided doesn't exist on Keybase, please try logging in again with a different username.
            </Text>
          </Box>
        </Box>
      )
    case ConstantsStatusCode.scbadloginpassword:
      return (
        <Box style={styleContent}>
          <Box style={{...globalStyles.flexBoxColumn, ...styleText}}>
            <Text type="Body">Looks like thats a bad passphrase.</Text>
            <Text
              type="BodyPrimaryLink"
              onClick={() => openURL('https://keybase.io/#password-reset')}
            >
              Reset your passphrase?
            </Text>
          </Box>
        </Box>
      )
    case ConstantsStatusCode.sckeysyncedpgpnotfound:
    case ConstantsStatusCode.scgpgunavailable:
    case ConstantsStatusCode.sckeynosecret:
      return (
        <Box style={styleContent}>
          <Box style={styleText}>
            <Text type="Body">
              Sorry, your account is already established with a PGP public key, but we can't access the corresponding private key.
            </Text>
          </Box>
          <Box style={{...styleText, textAlign: 'left', marginTop: 16}}>
            <Text type="BodySemibold">You have options:</Text>
          </Box>
          <Box style={styleList}>
            <Text type="Body">
              {' '}
              - Use
              {' '}
              <Text type="TerminalInline">keybase login</Text>
              {' '}
              on the command line to log in
            </Text>
            {!isMobile &&
              <Text type="Body">
                {' '}
                - Install GPG, put your PGP private key on this machine and try again
              </Text>}
            <Text type="Body">
              {' '}- Go back and provision with another device or paper key
            </Text>
            <Text type="Body">
              {' '}
              - Or,
              {' '}
              <Text
                type="BodyPrimaryLink"
                onClick={() => openURL('https://keybase.io/#account-reset')}
              >
                reset your account and start fresh
              </Text>
            </Text>
          </Box>
        </Box>
      )
    default:
      return (
        <Box style={styleContent}>
          <Text type="Body">Unknown error: {error.message}</Text>
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

const styleHeader = {
  alignSelf: 'center',
  marginTop: 46,
  marginBottom: 20,
}

const styleText = {
  marginBottom: 10,
  maxWidth: 460,
  textAlign: 'center',
}

const styleList = {
  ...styleText,
  ...globalStyles.flexBoxColumn,
  textAlign: 'left',
  lineHeight: '20px',
  marginLeft: globalMargins.tiny,
}

const styleContent = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
}

export default Render
