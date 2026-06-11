import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as React from 'react'
import type * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {openSMS as _openSMS} from '@/util/misc'
import {assertionToDisplay} from '@/common-adapters/usernames'
import {useUsersState} from '@/stores/users'
import {useFollowerState} from '@/stores/followers'
import {showShareActionSheet} from '@/util/platform-specific'
import {
  useConversationThreadID,
  useConversationThreadSelector,
} from './thread-context'

type Store = T.Immutable<{
  inviteBannerDismissed: Set<T.Chat.ConversationIDKey>
}>

const initialStore: Store = {
  inviteBannerDismissed: new Set(),
}

type State = Store & {
  dispatch: {
    dismissInviteBanner: (conversationIDKey: T.Chat.ConversationIDKey) => void
    resetState: () => void
  }
}

const useBottomBannerState = Z.createZustand<State>('chat-bottom-banner', set => {
  const dispatch: State['dispatch'] = {
    dismissInviteBanner: conversationIDKey => {
      set(s => {
        s.inviteBannerDismissed.add(conversationIDKey)
      })
    },
    resetState: Z.defaultReset,
  }

  return {
    ...initialStore,
    dispatch,
  }
})

const installMessage = `I sent you encrypted messages on Keybase. You can install it here: https://keybase.io/phone-app`

const Invite = (props: {onDismiss: () => void}) => {
  const linkUrlProps = Kb.useClickURL('https://keybase.io/app')
  const participantInfo = useConversationThreadSelector(s => s.participants)
  const participantInfoAll = participantInfo.all
  const users = participantInfoAll.filter(p => p.includes('@'))

  const openShareSheet = () => {
    showShareActionSheet({
      message: installMessage,
      mimeType: 'text/plain',
    })
      .then(() => {})
      .catch(() => {})
  }

  const openSMS = (phoneNumber: string) => {
    _openSMS(['+' + phoneNumber], installMessage)
      .then(() => {})
      .catch(() => {})
  }

  const usernameToContactName = participantInfo.contactName

  const theirName =
    users.length === 1
      ? usernameToContactName.get(users[0]!) || assertionToDisplay(users[0]!)
      : `these ${users.length} people`
  const mobileClickInstall =
    users.length === 1 && users[0]!.endsWith('@phone')
      ? () => openSMS(users[0]!.slice(0, -6))
      : openShareSheet
  const caption = `Last step: summon ${theirName}!`

  if (isMobile) {
    return (
      <BannerBox color={Kb.Styles.globalColors.blue} gap="xtiny">
        <Kb.Text center={true} type="BodySmallSemibold" negative={true}>
          {caption}
        </Kb.Text>
        <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true} centerChildren={true}>
          <Kb.Button
            label="Send install link"
            onClick={mobileClickInstall}
            small={true}
            style={styles.primaryOnBlue}
            labelStyle={styles.primaryOnBlueLabel}
          />
          <Kb.Button
            label="Dismiss"
            mode="Secondary"
            onClick={props.onDismiss}
            small={true}
            style={styles.secondaryOnColor}
            labelStyle={styles.secondaryOnColorLabel}
          />
        </Kb.Box2>
      </BannerBox>
    )
  }

  return (
    <BannerBox color={Kb.Styles.globalColors.blue}>
      <Kb.Text center={true} type="BodySmallSemibold" negative={true}>
        {caption}
      </Kb.Text>
      <Kb.Text center={true} type="BodySmallSemibold" negative={true}>
        Send them this link:
        <Kb.Text
          {...linkUrlProps}
          underline={true}
          type="BodySmallPrimaryLink"
          selectable={true}
          negative={true}
          style={{marginLeft: Kb.Styles.globalMargins.xtiny}}
        >
          https://keybase.io/app
        </Kb.Text>
      </Kb.Text>
    </BannerBox>
  )
}

const BannerContainer = function BannerContainer() {
  const conversationIDKey = useConversationThreadID()
  return <BannerContainerInner key={conversationIDKey} conversationIDKey={conversationIDKey} />
}

const BannerContainerInner = function BannerContainerInner(props: {
  conversationIDKey: T.Chat.ConversationIDKey
}) {
  const {conversationIDKey} = props
  const following = useFollowerState(s => s.following)
  const infoMap = useUsersState(s => s.infoMap)
  const {dismissed, dismissInviteBanner} = useBottomBannerState(
    C.useShallow(s => ({
      dismissInviteBanner: s.dispatch.dismissInviteBanner,
      dismissed: s.inviteBannerDismissed.has(conversationIDKey),
    }))
  )
  const {meta, participantInfo} = useConversationThreadSelector(
    C.useShallow(s => ({meta: s.meta, participantInfo: s.participants}))
  )
  if (meta.teamType !== 'adhoc') {
    return null
  }
  const participantInfoAll = participantInfo.all
  const brokenUsers = participantInfoAll.filter(p => following.has(p) && infoMap.get(p)?.broken)
  if (brokenUsers.length > 0) {
    return <Kb.ProofBrokenBanner users={brokenUsers} />
  }
  const toInvite = participantInfoAll.some(p => p.includes('@'))
  const hasMessages = !meta.isEmpty
  return toInvite && !dismissed && hasMessages ? (
    <Invite onDismiss={() => dismissInviteBanner(conversationIDKey)} />
  ) : null
}

export default BannerContainer

const BannerBox = (props: {
  children: React.ReactNode
  color: string
  gap?: keyof typeof Kb.Styles.globalMargins
}) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    style={Kb.Styles.collapseStyles([styles.bannerStyle, {backgroundColor: props.color}])}
    gap={props.gap}
    alignItems="center"
    justifyContent="center"
  >
    {props.children}
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bannerStyle: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexWrap,
          ...Kb.Styles.padding(8, 24),
        },
        isElectron: {
          marginBottom: Kb.Styles.globalMargins.tiny,
        },
      }),
      primaryOnBlue: {backgroundColor: Kb.Styles.globalColors.white},
      primaryOnBlueLabel: {color: Kb.Styles.globalColors.blueDark},
      secondaryOnColor: Kb.Styles.platformStyles({
        common: {backgroundColor: Kb.Styles.globalColors.black_20},
        isMobile: {borderWidth: 0},
      }),
      secondaryOnColorLabel: {color: Kb.Styles.globalColors.white},
    }) as const
)
