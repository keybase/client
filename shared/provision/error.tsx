import * as C from '@/constants'
import * as AutoReset from '@/stores/autoreset'
import * as Kb from '@/common-adapters'
import type * as React from 'react'
import LoginContainer from '../login/forms/container'
import openURL from '@/util/open-url'
import * as T from '@/constants/types'
import {useProvisionState} from '@/stores/provision'

const Wrapper = (p: {onBack: () => void; children: React.ReactNode}) => (
  <LoginContainer onBack={p.onBack}>
    <Kb.Icon type="icon-illustration-zen-240-180" style={styles.icon} />
    <Kb.Text3 type="Header" style={styles.header}>
      Oops, something went wrong.
    </Kb.Text3>
    <Kb.Box2 direction="vertical" gap="small" gapStart={true} gapEnd={true} style={styles.container}>
      {p.children}
    </Kb.Box2>
    {Kb.Styles.isMobile && <Kb.Button label="Close" onClick={p.onBack} />}
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
const RenderError = () => {
  const _username = AutoReset.useAutoResetState(s => s.username)
  const error = useProvisionState(s => s.finalError)
  const startAccountReset = AutoReset.useAutoResetState(s => s.dispatch.startAccountReset)
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
  const onAccountReset = () => _onAccountReset(_username)

  if (!error) {
    return (
      <Wrapper onBack={onBack}>
        <Kb.Text3 center={true} type="Body">
          Unknown error: Please report this to us.
        </Kb.Text3>
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
          <Kb.Text3 center={true} type="Body">
            The device authorization failed because this device went offline.
          </Kb.Text3>
          <Kb.Text3 center={true} type="Body">
            Please check your network connection and try again.
          </Kb.Text3>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.scdevicenoprovision:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text3 center={true} type="Body">
            {"You can't authorize by password, since you have established device or paper keys."}
          </Kb.Text3>
          <Kb.Text3 center={true} type="Body">
            You can go back and pick a device or paper key, or{' '}
            <Kb.Text3 type="BodyPrimaryLink" onClick={onAccountReset}>
              reset your account entirely
            </Kb.Text3>
            .
          </Kb.Text3>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.scdeviceprevprovisioned:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text3 center={true} type="Body">
            You have already authorized this device.{' '}
          </Kb.Text3>
          <Kb.Text3 center={true} type="Body">
            {"Please use 'keybase login [username]' to log in. "}
          </Kb.Text3>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.sckeynomatchinggpg:
      if (fields['has_active_device']) {
        return (
          <Wrapper onBack={onBack}>
            <Kb.Text3 center={true} type="Body">
              {"You can't authorize using solely a password, since you have active device keys."}
            </Kb.Text3>
            <Kb.Text3 center={true} type="BodySemibold">
              You have options:
            </Kb.Text3>

            <Kb.Box2 direction="vertical" style={styles.list}>
              <Kb.Text3 center={true} type="Body">
                {' - Go back and select a device or paper key'}
              </Kb.Text3>
              <Kb.Text3 center={true} type="Body">
                {' - Install Keybase on a machine that has your PGP private key in it'}
              </Kb.Text3>
              <Kb.Text3 center={true} type="Body">
                {' - Login to the website and host an encrypted copy of your PGP private key'}
              </Kb.Text3>
              <Kb.Text3 center={true} type="Body">
                {' - or, '}
                <Kb.Text3 type="BodyPrimaryLink" onClick={onAccountReset}>
                  reset your account entirely
                </Kb.Text3>
                {'.'}
              </Kb.Text3>
            </Kb.Box2>
          </Wrapper>
        )
      } else {
        return (
          <Wrapper onBack={onBack}>
            <Kb.Text3 center={true} type="Body">
              {"You can't authorize using a password, since you've established a PGP key."}
            </Kb.Text3>
            <Kb.Text3 center={true} type="BodySemibold" style={{textAlign: 'left'}}>
              You have options:
            </Kb.Text3>
            <Kb.Box2 direction="vertical" style={styles.list}>
              <Kb.Text3 center={true} type="Body">
                {' - Use '}
                <Kb.Text3 type="TerminalInline">keybase login</Kb.Text3> on the command line to log in
              </Kb.Text3>
              {!Kb.Styles.isMobile && (
                <Kb.Text3 center={true} type="Body">
                  {' - Install GPG on this machine and import your PGP private key into it'}
                </Kb.Text3>
              )}
              <Kb.Text3 center={true} type="Body">
                {' - Install Keybase on a different machine that has your PGP key'}
              </Kb.Text3>
              <Kb.Text3 center={true} type="Body">
                {' - Login to the website and host an encrypted copy of your PGP private key'}
              </Kb.Text3>
              <Kb.Text3 center={true} type="Body">
                {' - Or, '}
                <Kb.Text3 type="BodyPrimaryLink" onClick={onAccountReset}>
                  reset your account entirely
                </Kb.Text3>
                .
              </Kb.Text3>
            </Kb.Box2>
          </Wrapper>
        )
      }
    case T.RPCGen.StatusCode.sckeynotfound:
      return error.desc ? (
        <Wrapper onBack={onBack}>
          <Kb.Markdown>{error.desc}</Kb.Markdown>
        </Wrapper>
      ) : (
        <Wrapper onBack={onBack}>
          <Kb.Text3 center={true} type="Body">
            {
              "Your PGP keychain has multiple keys installed, and we're not sure which one to use to authorize your account."
            }
          </Kb.Text3>
          <Kb.Text3 center={true} type="Body">
            Please run <Kb.Text3 type="TerminalInline">keybase login</Kb.Text3> on the command line to continue.
          </Kb.Text3>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.scbadloginpassword:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text3 center={true} type="Body">
            {"Looks like that's a bad password."}
          </Kb.Text3>
          <Kb.Text3 center={true} type="BodyPrimaryLink" onClick={onPasswordReset}>
            Reset your password?
          </Kb.Text3>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.sckeysyncedpgpnotfound:
    case T.RPCGen.StatusCode.scgpgunavailable:
    case T.RPCGen.StatusCode.sckeynosecret:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text3 center={true} type="Body">
            {
              "Sorry, your account is already established with a PGP public key, but we can't access the corresponding private key."
            }
          </Kb.Text3>
          <Kb.Text3 center={true} type="BodySemibold">
            You have options:
          </Kb.Text3>
          <Kb.Box2 direction="vertical" style={styles.list}>
            <Kb.Text3 center={true} type="Body">
              {' - Run '}
              <Kb.Text3 type="TerminalInline">keybase login</Kb.Text3> on the device with the corresponding PGP
              private key
            </Kb.Text3>
            {!Kb.Styles.isMobile && (
              <Kb.Text3 center={true} type="Body">
                {' - Install GPG, put your PGP private key on this machine and try again'}
              </Kb.Text3>
            )}
            <Kb.Text3 center={true} type="Body">
              {' - Go back and authorize with another device or paper key'}
            </Kb.Text3>
            <Kb.Text3 center={true} type="Body">
              {' - Or, if none of the above are possible, '}
              <Kb.Text3 type="BodyPrimaryLink" onClick={onAccountReset}>
                reset your account and start fresh
              </Kb.Text3>
            </Kb.Text3>
          </Kb.Box2>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.scinputcanceled:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text3 center={true} type="Body">
            Login cancelled.
          </Kb.Text3>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.sckeycorrupted:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text3 center={true} type="Body">
            {error.message}
          </Kb.Text3>
          <Kb.Text3 center={true} type="Body">
            We were able to generate a PGP signature but it was rejected by the server.
          </Kb.Text3>
          <Kb.Text3 type="Body">This often means that this PGP key is expired or unusable.</Kb.Text3>
          <Kb.Text3 center={true} type="Body">
            You can update your key on{' '}
            <Kb.Text3 type="BodyPrimaryLink" onClick={onKBHome}>
              keybase.io
            </Kb.Text3>
            .
          </Kb.Text3>
        </Wrapper>
      )
    case T.RPCGen.StatusCode.scdeleted:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Text3 center={true} type="Body">
            This user has been deleted.
          </Kb.Text3>
        </Wrapper>
      )
    default:
      return (
        <Wrapper onBack={onBack}>
          <Kb.Box2 direction="vertical">
            <Kb.Text3 center={true} type="Body" selectable={true}>
              {rewriteErrorDesc(error.desc)}
            </Kb.Text3>
            <Kb.Text3 center={true} type="BodySmall" selectable={true}>
              {' ' + error.details}
            </Kb.Text3>
          </Kb.Box2>
        </Wrapper>
      )
  }
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {maxWidth: 550},
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
        marginLeft: Kb.Styles.globalMargins.tiny,
        ...Kb.Styles.globalStyles.flexBoxColumn,
        maxWidth: 460,
      },
    }) as const
)

export default RenderError
