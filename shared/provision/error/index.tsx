// TODO remove Container
import Container from '../../login/forms/container'
import * as React from 'react'
import {RPCError} from '../../util/errors'
import {StatusCode} from '../../constants/types/rpc-gen'
import {Box2, Text, Markdown} from '../../common-adapters'
import {styleSheetCreate, globalStyles, globalMargins, isMobile} from '../../styles'

type Props = {
  error: RPCError | null
  onAccountReset: () => void
  onBack: () => void
  onKBHome: () => void
  onPasswordReset: () => void
}

const List = p => (
  <Box2 direction="vertical" style={styles.list}>
    {p.children}
  </Box2>
)

const Wrapper = (p: {onBack: () => void; children: React.ReactNode}) => (
  <Container onBack={p.onBack}>
    <Text type="Header" style={styles.header}>
      There was an error provisioning
    </Text>
    <Box2 direction="vertical" gap="small" gapStart={true} gapEnd={true} style={styles.container}>
      {p.children}
    </Box2>
  </Container>
)

const rewriteErrorDesc = {
  'Provisioner is a different user than we wanted.':
    'Is the other device using the username you expect? It seems to be different. Please try again!',
}

// Normally this would be a component but I want the children to be flat so i can use a Box2 as the parent and have nice gaps
const Render = ({error, onBack, onAccountReset, onPasswordReset, onKBHome}: Props) => {
  if (!error) {
    return (
      <Wrapper onBack={onBack}>
        <Text type="Body">Unknown error: Please report this to us</Text>
      </Wrapper>
    )
  }
  const fields = (Array.isArray(error.fields) ? error.fields : []).reduce((acc, f) => {
    const k = f && typeof f.key === 'string' ? f.key : ''
    acc[k] = f.value || ''
    return acc
  }, {})
  switch (error.code) {
    case StatusCode.scdeviceprovisionoffline:
    case StatusCode.scapinetworkerror:
      return (
        <Wrapper onBack={onBack}>
          <Text type="Body">Device provisioning failed because this device went offline.</Text>
          <Text type="Body">Please check your network connection and try again.</Text>
        </Wrapper>
      )
    case StatusCode.scdevicenoprovision:
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
    case StatusCode.scdeviceprevprovisioned:
      return (
        <Wrapper onBack={onBack}>
          <Text type="Body">You have already provisioned this device. </Text>
          <Text type="Body">Please use 'keybase login [username]' to log in. </Text>
        </Wrapper>
      )
    case StatusCode.sckeynomatchinggpg:
      if (fields.has_active_device) {
        return (
          <Wrapper onBack={onBack}>
            <Text type="Body">
              You can't provision using solely a password, since you have active device keys.
            </Text>
            <Text type="BodySemibold">You have options:</Text>
            <List>
              <Text type="Body"> - Go back and select a device or paper key</Text>
              <Text type="Body"> - Install Keybase on a machine that has your PGP private key in it</Text>
              <Text type="Body">
                {' '}
                - Login to the website and host an encrypted copy of your PGP private key
              </Text>
              <Text type="Body">
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
            <Text type="Body">You can't provision using a password, since you've established a PGP key.</Text>
            <Text type="BodySemibold" style={{textAlign: 'left'}}>
              You have options:
            </Text>
            <List>
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
                <Text type="BodyPrimaryLink" onClick={onAccountReset}>
                  reset your account entirely
                </Text>
                .
              </Text>
            </List>
          </Wrapper>
        )
      }
    case StatusCode.sckeynotfound:
      return error.desc ? (
        <Wrapper onBack={onBack}>
          <Markdown>{error.desc}</Markdown>
        </Wrapper>
      ) : (
        <Wrapper onBack={onBack}>
          <Text center={true} type="Body">
            Your PGP keychain has multiple keys installed, and we're not sure which one to use to provision
            your account. continue.
          </Text>
          <Text center={true} type="Body">
            Please run <Text type="TerminalInline">keybase login</Text> on the command line to
          </Text>
        </Wrapper>
      )
    case StatusCode.scbadloginpassword:
      return (
        <Wrapper onBack={onBack}>
          <Text type="Body">Looks like that's a bad password.</Text>
          <Text center={true} type="BodyPrimaryLink" onClick={onPasswordReset}>
            Reset your password?
          </Text>
        </Wrapper>
      )
    case StatusCode.sckeysyncedpgpnotfound:
    case StatusCode.scgpgunavailable:
    case StatusCode.sckeynosecret:
      return (
        <Wrapper onBack={onBack}>
          <Text center={true} type="Body">
            Sorry, your account is already established with a PGP public key, but we can't access the
            corresponding private key.
          </Text>
          <Text type="BodySemibold" style={{textAlign: 'left'}}>
            You have options:
          </Text>
          <List>
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
              <Text type="BodyPrimaryLink" onClick={onAccountReset}>
                reset your account and start fresh
              </Text>
            </Text>
          </List>
        </Wrapper>
      )
    case StatusCode.scinputcanceled:
      return (
        <Wrapper onBack={onBack}>
          <Text type="Body">Login Cancelled</Text>
        </Wrapper>
      )
    case StatusCode.sckeycorrupted:
      return (
        <Wrapper onBack={onBack}>
          <Text type="Body">{error.message}</Text>
          <Text type="Body">We were able to generate a PGP signature but it was rejected by the server.</Text>
          <Text type="Body">This often means that this PGP key is expired or unusable.</Text>
          <Text type="Body">
            You can update your key on{' '}
            <Text type="BodyPrimaryLink" onClick={onKBHome}>
              keybase.io
            </Text>
            .
          </Text>
        </Wrapper>
      )
    case StatusCode.scdeleted:
      return (
        <Wrapper onBack={onBack}>
          <Text type="Body">User has been deleted.</Text>
        </Wrapper>
      )
    default:
      return (
        <Wrapper onBack={onBack}>
          <Text type="Body">
            <Text type="Body" selectable={true}>
              {rewriteErrorDesc[error.desc] || error.desc}
            </Text>
            <Text type="BodySmall" selectable={true}>
              {' '}
              {error.details}
            </Text>
          </Text>
        </Wrapper>
      )
  }
}

const styles = styleSheetCreate({
  container: {
    maxWidth: 550,
  },
  header: {
    alignSelf: 'center',
    marginBottom: 20,
    marginTop: 46,
  },
  list: {
    marginBottom: 10,
    marginLeft: globalMargins.tiny,
    ...globalStyles.flexBoxColumn,
    maxWidth: 460,
  },
})

export default Render
