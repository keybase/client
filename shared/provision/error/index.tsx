// TODO remove Container
import Container from '../../login/forms/container'
import * as React from 'react'
import * as Styles from '../../styles'
import {RPCError} from '../../util/errors'
import {StatusCode} from '../../constants/types/rpc-gen'
import * as Kb from '../../common-adapters'

type Props = {
  error?: RPCError
  onAccountReset: () => void
  onBack: () => void
  onKBHome: () => void
  onPasswordReset: () => void
}

const List = p => (
  <Kb.Box2 direction="vertical" style={styles.list}>
    {p.children}
  </Kb.Box2>
)

const Wrapper = (p: {onBack: () => void; children: React.ReactNode}) => (
  <Container onBack={p.onBack}>
    <Kb.Icon type={Kb.IconType.icon_illustration_zen_240_180} style={styles.icon} />
    <Kb.Text type="Header" style={styles.header}>
      Oops, something went wrong.
    </Kb.Text>
    <Kb.Box2 direction="vertical" gap="small" gapStart={true} gapEnd={true} style={styles.container}>
      {p.children}
    </Kb.Box2>
    {Styles.isMobile && <Kb.Button label="Close" onClick={p.onBack} />}
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
        <Kb.Text type="Body">Unknown error: Please report this to us.</Kb.Text>
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
          <Kb.Text type="Body">Device authorization failed because this device went offline.</Kb.Text>
          <Kb.Text type="Body">Please check your network connection and try again.</Kb.Text>
        </Wrapper>
      )
    case StatusCode.scdevicenoprovision:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text center={true} type="Body">
            You can't authorize by password, since you have established device or paper keys.
          </Kb.Text>
          <Kb.Text center={true} type="Body">
            You can go back and pick a device or paper key, or{' '}
            <Kb.Text type="BodyPrimaryLink" onClick={onAccountReset}>
              reset your account entirely
            </Kb.Text>
            .
          </Kb.Text>
        </Wrapper>
      )
    case StatusCode.scdeviceprevprovisioned:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text type="Body">You have already authorized this device. </Kb.Text>
          <Kb.Text type="Body">Please use 'keybase login [username]' to log in. </Kb.Text>
        </Wrapper>
      )
    case StatusCode.sckeynomatchinggpg:
      if (fields.has_active_device) {
        return (
          <Wrapper onBack={onBack}>
            <Kb.Text type="Body">
              You can't authorize using solely a password, since you have active device keys.
            </Kb.Text>
            <Kb.Text type="BodySemibold">You have options:</Kb.Text>
            <List>
              <Kb.Text type="Body"> - Go back and select a device or paper key</Kb.Text>
              <Kb.Text type="Body">
                {' '}
                - Install Keybase on a machine that has your PGP private key in it
              </Kb.Text>
              <Kb.Text type="Body">
                {' '}
                - Login to the website and host an encrypted copy of your PGP private key
              </Kb.Text>
              <Kb.Text type="Body">
                {' '}
                - or,{' '}
                <Kb.Text type="BodyPrimaryLink" onClick={onAccountReset}>
                  reset your account entirely
                </Kb.Text>
                .
              </Kb.Text>
            </List>
          </Wrapper>
        )
      } else {
        return (
          <Wrapper onBack={onBack}>
            <Kb.Text type="Body">
              You can't authorize using a password, since you've established a PGP key.
            </Kb.Text>
            <Kb.Text type="BodySemibold" style={{textAlign: 'left'}}>
              You have options:
            </Kb.Text>
            <List>
              <Kb.Text type="Body">
                {' '}
                - Use <Kb.Text type="TerminalInline">keybase login</Kb.Text> on the command line to log in
              </Kb.Text>
              {!Styles.isMobile && (
                <Kb.Text type="Body">
                  {' '}
                  - Install GPG on this machine and import your PGP private key into it
                </Kb.Text>
              )}
              <Kb.Text type="Body"> - Install Keybase on a different machine that has your PGP key</Kb.Text>
              <Kb.Text type="Body">
                {' '}
                - Login to the website and host an encrypted copy of your PGP private key
              </Kb.Text>
              <Kb.Text type="Body">
                {' '}
                - Or,{' '}
                <Kb.Text type="BodyPrimaryLink" onClick={onAccountReset}>
                  reset your account entirely
                </Kb.Text>
                .
              </Kb.Text>
            </List>
          </Wrapper>
        )
      }
    case StatusCode.sckeynotfound:
      return error.desc ? (
        <Wrapper onBack={onBack}>
          <Kb.Markdown>{error.desc}</Kb.Markdown>
        </Wrapper>
      ) : (
        <Wrapper onBack={onBack}>
          <Kb.Text center={true} type="Body">
            Your PGP keychain has multiple keys installed, and we're not sure which one to use to authorize
            your account.
          </Kb.Text>
          <Kb.Text center={true} type="Body">
            Please run <Kb.Text type="TerminalInline">keybase login</Kb.Text> on the command line to continue.
          </Kb.Text>
        </Wrapper>
      )
    case StatusCode.scbadloginpassword:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text type="Body">Looks like that's a bad password.</Kb.Text>
          <Kb.Text center={true} type="BodyPrimaryLink" onClick={onPasswordReset}>
            Reset your password?
          </Kb.Text>
        </Wrapper>
      )
    case StatusCode.sckeysyncedpgpnotfound:
    case StatusCode.scgpgunavailable:
    case StatusCode.sckeynosecret:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text center={true} type="Body">
            Sorry, your account is already established with a PGP public key, but we can't access the
            corresponding private key.
          </Kb.Text>
          <Kb.Text type="BodySemibold" style={{textAlign: 'left'}}>
            You have options:
          </Kb.Text>
          <List>
            <Kb.Text type="Body">
              {' '}
              - Run <Kb.Text type="TerminalInline">keybase login</Kb.Text> on the device with the
              corresponding PGP private key
            </Kb.Text>
            {!Styles.isMobile && (
              <Kb.Text type="Body">
                {' '}
                - Install GPG, put your PGP private key on this machine and try again
              </Kb.Text>
            )}
            <Kb.Text type="Body"> - Go back and authorize with another device or paper key</Kb.Text>
            <Kb.Text type="Body">
              {' '}
              - Or, if none of the above are possible,{' '}
              <Kb.Text type="BodyPrimaryLink" onClick={onAccountReset}>
                reset your account and start fresh
              </Kb.Text>
            </Kb.Text>
          </List>
        </Wrapper>
      )
    case StatusCode.scinputcanceled:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text type="Body">Login Cancelled</Kb.Text>
        </Wrapper>
      )
    case StatusCode.sckeycorrupted:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text type="Body">{error.message}</Kb.Text>
          <Kb.Text type="Body">
            We were able to generate a PGP signature but it was rejected by the server.
          </Kb.Text>
          <Kb.Text type="Body">This often means that this PGP key is expired or unusable.</Kb.Text>
          <Kb.Text type="Body">
            You can update your key on{' '}
            <Kb.Text type="BodyPrimaryLink" onClick={onKBHome}>
              keybase.io
            </Kb.Text>
            .
          </Kb.Text>
        </Wrapper>
      )
    case StatusCode.scdeleted:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text type="Body">User has been deleted.</Kb.Text>
        </Wrapper>
      )
    default:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text type="Body">
            <Kb.Text type="Body" selectable={true}>
              {rewriteErrorDesc[error.desc] || error.desc}
            </Kb.Text>
            <Kb.Text type="BodySmall" selectable={true}>
              {' '}
              {error.details}
            </Kb.Text>
          </Kb.Text>
        </Wrapper>
      )
  }
}

const styles = Styles.styleSheetCreate(
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
        marginLeft: Styles.globalMargins.tiny,
        ...Styles.globalStyles.flexBoxColumn,
        maxWidth: 460,
      },
    } as const)
)

export default Render
