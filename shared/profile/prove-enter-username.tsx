import * as C from '@/constants'
import {useProfileState} from '@/stores/profile'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import Modal from './modal'
import * as T from '@/constants/types'
import {normalizeProofUsername} from './proof-utils'

type Props = {
  error?: string
  platform: T.More.PlatformsExpandedType
  username?: string
}

const Container = ({error: routeError, platform, username: initialUsername = ''}: Props) => {
  const cancelAddProof = useProfileState(s => s.dispatch.dynamic.cancelAddProof)
  const submitUsername = useProfileState(s => s.dispatch.dynamic.submitUsername)
  const registerCryptoAddress = C.useRPC(T.RPCGen.cryptocurrencyRegisterAddressRpcPromise)
  const [username, setUsername] = React.useState(initialUsername)
  const [errorText, setErrorText] = React.useState(routeError === 'Input canceled' ? '' : (routeError ?? ''))
  const [canSubmit, setCanSubmit] = React.useState(!!initialUsername.length)

  React.useEffect(() => {
    setErrorText(routeError === 'Input canceled' ? '' : (routeError ?? ''))
  }, [routeError])

  React.useEffect(() => {
    setUsername(initialUsername)
    setCanSubmit(!!initialUsername.length)
  }, [initialUsername])

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _onSubmit = (input: string, platform?: string) => {
    const {normalized, valid} = normalizeProofUsername(
      platform as T.More.PlatformsExpandedType | undefined,
      input
    )

    if (platform === 'btc') {
      if (!valid) {
        setErrorText('Invalid address format')
        return
      }
      setErrorText('')
      registerCryptoAddress(
        [{address: normalized, force: true, wantedFamily: 'bitcoin'}, C.waitingKeyProfile],
        () => {
          navigateAppend({
            name: 'profileConfirmOrPending',
            params: {
              platform,
              proofFound: true,
              proofStatus: T.RPCGen.ProofStatus.ok,
              username: normalized,
            },
          })
        },
        error => {
          setErrorText(error.desc)
        }
      )
    } else if (platform === 'zcash') {
      setErrorText('')
      registerCryptoAddress(
        [{address: normalized, force: true, wantedFamily: 'zcash'}, C.waitingKeyProfile],
        () => {
          navigateAppend({
            name: 'profileConfirmOrPending',
            params: {
              platform,
              proofFound: true,
              proofStatus: T.RPCGen.ProofStatus.ok,
              username: normalized,
            },
          })
        },
        error => {
          setErrorText(error.desc)
        }
      )
    } else {
      setErrorText('')
      submitUsername?.(normalized)
    }
  }
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onCancel = () => {
    cancelAddProof?.()
    clearModals()
  }
  const onSubmit = (username: string) => _onSubmit(username, platform)

  const submit = () => {
    if (canSubmit) {
      onSubmit(username)
    }
  }

  const onChangeUsername = (username: string) => {
    setUsername(username)
    setCanSubmit(!!username.length)
  }

  const pt = platformText[platform]
  if (!pt.headerText) {
    throw new Error(`Proofs for platform ${platform} are unsupported.`)
  }
  const {headerText, hintText} = pt

  return (
    <Modal onCancel={onCancel} skipButton={true}>
      {!!errorText && (
        <Kb.Box2 direction="vertical" gap="small" style={styles.error} fullWidth={true}>
          <Kb.Text center={true} negative={true} type="BodySemibold">
            {errorText}
          </Kb.Text>
        </Kb.Box2>
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
        {C.isMobile ? null : (
          <Kb.Text center={true} type="Header">
            {headerText}
          </Kb.Text>
        )}
        <Kb.PlatformIcon
          style={styles.centered}
          platform={platform}
          overlay="icon-proof-unfinished"
          overlayColor={Kb.Styles.globalColors.greyDark}
        />
        <Kb.Input3
          autoFocus={true}
          placeholder={hintText}
          value={username}
          onChangeText={onChangeUsername}
          onEnterKeyDown={submit}
        />
        <UsernameTips platform={platform} />
        <Kb.Box2 direction="horizontal" gap="small">
          <Kb.WaitingButton
            waitingKey={C.waitingKeyProfile}
            onlyDisable={true}
            type="Dim"
            onClick={onCancel}
            label="Cancel"
          />
          <Kb.WaitingButton
            waitingKey={C.waitingKeyProfile}
            disabled={!canSubmit}
            onClick={submit}
            label="Continue"
          />
        </Kb.Box2>
      </Kb.Box2>
    </Modal>
  )
}

const UsernameTips = ({platform}: {platform: T.More.PlatformsExpandedType}) =>
  platform === 'hackernews' ? (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tips}>
      <Kb.Text type="BodySmallSemibold">&bull; You must have karma &ge; 2</Kb.Text>
      <Kb.Text type="BodySmallSemibold">&bull; You must enter your uSeRName with exact case</Kb.Text>
    </Kb.Box2>
  ) : null

const standardText = (name: string) => ({
  headerText: C.isMobile ? `Prove ${name}` : `Prove your ${name} identity`,
  hintText: `Your ${name} username`,
})

const invalidText = () => ({
  headerText: '',
  hintText: '',
})

const platformText = {
  btc: {
    headerText: 'Set a Bitcoin address',
    hintText: 'Your Bitcoin address',
  },
  dns: {
    headerText: 'Prove your domain',
    hintText: 'yourdomain.com',
  },
  dnsOrGenericWebSite: invalidText(),
  facebook: standardText('Facebook'),
  github: standardText('GitHub'),
  hackernews: standardText('Hacker News'),
  http: {
    headerText: 'Prove your http website',
    hintText: 'http://whatever.yoursite.com',
  },
  https: {
    headerText: 'Prove your https website',
    hintText: 'https://whatever.yoursite.com',
  },
  pgp: invalidText(),
  reddit: standardText('Reddit'),
  rooter: invalidText(),
  twitter: standardText('Twitter'),
  web: {
    headerText: 'Prove your website',
    hintText: 'whatever.yoursite.com',
  },
  zcash: {
    headerText: 'Set a Zcash address',
    hintText: 'Your z_address or t_address',
  },
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  centered: {alignSelf: 'center'},
  error: {
    backgroundColor: Kb.Styles.globalColors.red,
    borderRadius: Kb.Styles.borderRadius,
    marginBottom: Kb.Styles.globalMargins.small,
    padding: Kb.Styles.globalMargins.medium,
  },
  tips: {padding: Kb.Styles.globalMargins.small},
}))

export default Container
