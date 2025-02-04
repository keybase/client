import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import Modal from '../modal'
import type * as T from '@/constants/types'

type Props = {
  platform: T.More.PlatformsExpandedType
  username: string
  errorText: string
  onSubmit: (username: string) => void
  onCancel: () => void
}

const EnterUsername = (props: Props) => {
  const [username, setUsername] = React.useState('')
  const [canSubmit, setCanSubmit] = React.useState(false)

  const submit = () => {
    if (canSubmit) {
      props.onSubmit(username)
    }
  }

  const onChangeUsername = (username: string) => {
    setUsername(username)
    setCanSubmit(!!username.length)
  }

  const pt = platformText[props.platform]
  if (!pt.headerText) {
    throw new Error(`Proofs for platform ${props.platform} are unsupported.`)
  }
  const {headerText, hintText} = pt

  return (
    <Modal onCancel={props.onCancel} skipButton={true} title={C.isMobile ? headerText : undefined}>
      {!!props.errorText && (
        <Kb.Box2 direction="vertical" gap="small" style={styles.error} fullWidth={true}>
          <Kb.Text center={true} negative={true} type="BodySemibold">
            {props.errorText}
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
          platform={props.platform}
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
        <UsernameTips platform={props.platform} />
        <Kb.Box2 direction="horizontal" gap="small">
          <Kb.WaitingButton
            waitingKey={C.Profile.waitingKey}
            onlyDisable={true}
            type="Dim"
            onClick={props.onCancel}
            label="Cancel"
          />
          <Kb.WaitingButton
            waitingKey={C.Profile.waitingKey}
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

export default EnterUsername
