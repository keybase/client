import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import LoginContainer from '../login/forms/container'
import openURL from '@/util/open-url'
import type {RPCError} from '@/util/errors'
import {Box2, Button, Icon, Text, Markdown} from '@/common-adapters'
import * as T from '@/constants/types'
import {styleSheetCreate, globalStyles, globalMargins, isMobile} from '@/styles'

const ConnectedRenderError = () => {
  const _username = C.useAutoResetState(s => s.username)
  const error = C.useProvisionState(s => s.finalError)
  const startAccountReset = C.useAutoResetState(s => s.dispatch.startAccountReset)
  const _onAccountReset = (username: string) => {
    startAccountReset(false, username)
  }
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const onKBHome = () => {
    openURL('https://keybase.io/')
  }
  const onPasswordReset = () => {
    openURL('https://keybase.io/#password-reset')
  }
  const props = {
    error,
    onAccountReset: () => _onAccountReset(_username),
    onBack,
    onKBHome,
    onPasswordReset,
  }
  return <RenderError {...props} />
}

export default ConnectedRenderError

type Props = {
  error?: RPCError
  onAccountReset: () => void
  onBack: () => void
  onKBHome: () => void
  onPasswordReset: () => void
}

const List = (p: {children: React.ReactNode}) => (
  <Box2 direction="vertical" style={styles.list}>
    {p.children}
  </Box2>
)

const Wrapper = (p: {onBack: () => void; children: React.ReactNode}) => (
  <LoginContainer onBack={p.onBack}>
    <Icon type="icon-illustration-zen-240-180" style={styles.icon} />
    <Text type="Header" style={styles.header}>
      Oops, something went wrong.
    </Text>
    <Box2 direction="vertical" gap="small" gapStart={true} gapEnd={true} style={styles.container}>
      {p.children}
    </Box2>
    {Kb.Styles.isMobile && <Button label="Close" onClick={p.onBack} />}
  </LoginContainer>
)

const rewriteErrorDesc = (s: string) => {
  switch (s) {
    case 'Provisioner is a different user than we wanted.':
      return 'Is the other device using the username you expect? It seems to be different.'
    default:
      return s
  }
}

// Normally this would be a component but I want the children to be flat so i can use a Box2 as the parent and have nice gaps
const RenderError = ({error, onBack, onAccountReset, onPasswordReset, onKBHome}: Props) => {
  if (!error) {
    return (
      <Wrapper onBack={onBack}>
        <Text center={true} type="Body">
          Unknown error: Please report this to us.
        </Text>
      </Wrapper>
    )
  }
  const f = error.fields as Array<undefined | {key?: string; value?: string}> | undefined
  const fields =
    f?.reduce<{[key: string]: string}>((acc, f) => {
      const k = f && typeof f.key === 'string' ? f.key : ''
      acc[k] = f?.value || ''
      return acc
    }, {}) ?? {}
  switch (error.code) {
    case T.RPCGen.StatusCode.scdeviceprovisionoffline:
    case T.RPCGen.StatusCode.scapinetworkerror:
      return (
        <Wrapper onBack={onBack}>
          <Text center={true} type="Body">
            The device authorization failed because this device went offline.
          </Text>
          <Text center={true} type="Body">
            Please check your network connection and try again.
          </Text>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.scdevicenoprovision:
      return (
        <Wrapper onBack={onBack}>
          <Text center={true} type="Body">
            You can't authorize by password, since you have established device or paper keys.
          </Text>
          <Text center={true} type="Body">
            You can go back and pick a device or paper key, or{' '}
            <Text type="BodyPrimaryLink" onClick={onAccountReset}>
              reset your account entirely
            </Text>
            .
          </Text>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.scdeviceprevprovisioned:
      return (
        <Wrapper onBack={onBack}>
          <Text center={true} type="Body">
            You have already authorized this device.{' '}
          </Text>
          <Text center={true} type="Body">
            Please use 'keybase login [username]' to log in.{' '}
          </Text>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.sckeynomatchinggpg:
      if (fields['has_active_device']) {
        return (
          <Wrapper onBack={onBack}>
            <Text center={true} type="Body">
              You can't authorize using solely a password, since you have active device keys.
            </Text>
            <Text center={true} type="BodySemibold">
              You have options:
            </Text>
            <List>
              <Text center={true} type="Body">
                {' '}
                - Go back and select a device or paper key
              </Text>
              <Text center={true} type="Body">
                {' '}
                - Install Keybase on a machine that has your PGP private key in it
              </Text>
              <Text center={true} type="Body">
                {' '}
                - Login to the website and host an encrypted copy of your PGP private key
              </Text>
              <Text center={true} type="Body">
                {' '}
                - or,{' '}
                <Text type="BodyPrimaryLink" onClick={onAccountReset}>
                  reset your account entirely
                </Text>
                .
              </Text>
            </List>
          </Wrapper>
        )
      } else {
        return (
          <Wrapper onBack={onBack}>
            <Text center={true} type="Body">
              You can't authorize using a password, since you've established a PGP key.
            </Text>
            <Text center={true} type="BodySemibold" style={{textAlign: 'left'}}>
              You have options:
            </Text>
            <List>
              <Text center={true} type="Body">
                {' '}
                - Use <Text type="TerminalInline">keybase login</Text> on the command line to log in
              </Text>
              {!isMobile && (
                <Text center={true} type="Body">
                  {' '}
                  - Install GPG on this machine and import your PGP private key into it
                </Text>
              )}
              <Text center={true} type="Body">
                {' '}
                - Install Keybase on a different machine that has your PGP key
              </Text>
              <Text center={true} type="Body">
                {' '}
                - Login to the website and host an encrypted copy of your PGP private key
              </Text>
              <Text center={true} type="Body">
                {' '}
                - Or,{' '}
                <Text type="BodyPrimaryLink" onClick={onAccountReset}>
                  reset your account entirely
                </Text>
                .
              </Text>
            </List>
          </Wrapper>
        )
      }
    case T.RPCGen.StatusCode.sckeynotfound:
      return error.desc ? (
        <Wrapper onBack={onBack}>
          <Markdown>{error.desc}</Markdown>
        </Wrapper>
      ) : (
        <Wrapper onBack={onBack}>
          <Text center={true} type="Body">
            Your PGP keychain has multiple keys installed, and we're not sure which one to use to authorize
            your account.
          </Text>
          <Text center={true} type="Body">
            Please run <Text type="TerminalInline">keybase login</Text> on the command line to continue.
          </Text>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.scbadloginpassword:
      return (
        <Wrapper onBack={onBack}>
          <Text center={true} type="Body">
            Looks like that's a bad password.
          </Text>
          <Text center={true} type="BodyPrimaryLink" onClick={onPasswordReset}>
            Reset your password?
          </Text>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.sckeysyncedpgpnotfound:
    case T.RPCGen.StatusCode.scgpgunavailable:
    case T.RPCGen.StatusCode.sckeynosecret:
      return (
        <Wrapper onBack={onBack}>
          <Text center={true} type="Body">
            Sorry, your account is already established with a PGP public key, but we can't access the
            corresponding private key.
          </Text>
          <Text center={true} type="BodySemibold">
            You have options:
          </Text>
          <List>
            <Text center={true} type="Body">
              {' '}
              - Run <Text type="TerminalInline">keybase login</Text> on the device with the corresponding PGP
              private key
            </Text>
            {!isMobile && (
              <Text center={true} type="Body">
                {' '}
                - Install GPG, put your PGP private key on this machine and try again
              </Text>
            )}
            <Text center={true} type="Body">
              {' '}
              - Go back and authorize with another device or paper key
            </Text>
            <Text center={true} type="Body">
              {' '}
              - Or, if none of the above are possible,{' '}
              <Text type="BodyPrimaryLink" onClick={onAccountReset}>
                reset your account and start fresh
              </Text>
            </Text>
          </List>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.scinputcanceled:
      return (
        <Wrapper onBack={onBack}>
          <Text center={true} type="Body">
            Login cancelled.
          </Text>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.sckeycorrupted:
      return (
        <Wrapper onBack={onBack}>
          <Text center={true} type="Body">
            {error.message}
          </Text>
          <Text center={true} type="Body">
            We were able to generate a PGP signature but it was rejected by the server.
          </Text>
          <Text type="Body">This often means that this PGP key is expired or unusable.</Text>
          <Text center={true} type="Body">
            You can update your key on{' '}
            <Text type="BodyPrimaryLink" onClick={onKBHome}>
              keybase.io
            </Text>
            .
          </Text>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.scdeleted:
      return (
        <Wrapper onBack={onBack}>
          <Text center={true} type="Body">
            This user has been deleted.
          </Text>
        </Wrapper>
      )
    default:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Box2 direction="vertical">
            <Text center={true} type="Body" selectable={true}>
              {rewriteErrorDesc(error.desc)}
            </Text>
            <Text center={true} type="BodySmall" selectable={true}>
              {' '}
              {error.details}
            </Text>
          </Kb.Box2>
        </Wrapper>
      )
  }
}

const styles = styleSheetCreate(
  () =>
    ({
      container: {
        maxWidth: 550,
      },
      header: {
        alignSelf: 'center',
        marginBottom: 20,
        marginTop: 46,
      },
      icon: {
        alignSelf: 'center',
        height: 180,
        width: 240,
      },
      list: {
        marginBottom: 10,
        marginLeft: globalMargins.tiny,
        ...globalStyles.flexBoxColumn,
        maxWidth: 460,
      },
    }) as const
)
