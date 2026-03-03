import * as C from '@/constants'
import {useProfileState} from '@/stores/profile'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import Modal from './modal'
import type * as T from '@/constants/types'

const Container = () => {
  const platform = useProfileState(s => s.platform)
  const _errorText = useProfileState(s => s.errorText)
  const updateUsername = useProfileState(s => s.dispatch.updateUsername)
  const cancelAddProof = useProfileState(s => s.dispatch.dynamic.cancelAddProof)
  const submitBTCAddress = useProfileState(s => s.dispatch.submitBTCAddress)
  const submitZcashAddress = useProfileState(s => s.dispatch.submitZcashAddress)
  const submitUsername = useProfileState(s => s.dispatch.dynamic.submitUsername)

  if (!platform) {
    throw new Error('No platform passed to prove enter username')
  }

  const errorText = _errorText === 'Input canceled' ? '' : _errorText

  const _onSubmit = (username: string, platform?: string) => {
    updateUsername(username)

    if (platform === 'btc') {
      submitBTCAddress()
    } else if (platform === 'zcash') {
      submitZcashAddress()
    } else {
      submitUsername?.()
    }
  }
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onCancel = () => {
    cancelAddProof?.()
    clearModals()
  }
  const onSubmit = (username: string) => _onSubmit(username, platform)

  const [username, setUsername] = React.useState('')
  const [canSubmit, setCanSubmit] = React.useState(false)

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
    <Modal onCancel={onCancel} skipButton={true} title={C.isMobile ? headerText : undefined}>
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
        <Kb.LabeledInput
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
