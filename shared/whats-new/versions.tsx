import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Platform from '../constants/platform'
import * as Tabs from '../constants/tabs'
import {encryptTab} from '../constants/crypto'
import {cryptoTab, displayTab} from '../constants/settings'
import {keybaseFM} from '../constants/whats-new'
import NewFeatureRow from './new-feature-row'

export type VersionProps = {
  seen: boolean
  onNavigate: (props: {
    fromKey?: string
    path: Array<{props?: {}; selected: string}>
    replace?: boolean
  }) => void
  onNavigateExternal: (url: string) => void
  onSwitchTab: (tab: Tabs.AppTab) => void
}

export const Version = ({children}: {children: React.ReactNode}) => {
  return (
    // Always pass `seen` prop to children of a version to show row-level badging
    <Kb.Box2 direction="vertical" alignItems="flex-start" fullWidth={true}>
      {children}
    </Kb.Box2>
  )
}

export const VersionTitle = ({title}: {title: string}) => (
  <Kb.Box2 direction="vertical" alignItems="flex-start" fullWidth={true}>
    <Kb.Text type="BodySmallSemibold" style={styles.versionTitle}>
      {title}
    </Kb.Text>
  </Kb.Box2>
)

export const Current = ({onSwitchTab, seen}: VersionProps) => {
  return (
    <Version>
      <NewFeatureRow
        noSeparator={true}
        seen={seen}
        primaryButtonText="Go to Teams"
        onPrimaryButtonClick={() => {
          onSwitchTab(Tabs.teamsTab)
        }}
      >
        Administering groups is easier than ever with the redesigned Teams tab.
      </NewFeatureRow>
    </Version>
  )
}

export const Last = ({seen}: VersionProps) => {
  return (
    <Version>
      <VersionTitle title="Last release" />
      <NewFeatureRow image="release-5.4.0-emoji" noSeparator={true} seen={seen} unwrapped={true}>
        <Kb.Box2 alignSelf="flex-start" direction="vertical">
          <Kb.Text type="BodySmall" allowFontScaling={true}>
            Browse your image library
          </Kb.Text>
          <Kb.Box2 direction="horizontal" style={styles.ponyAlignment}>
            <Kb.Text type="BodySmall" allowFontScaling={true}>
              And unleash that cute little pony
            </Kb.Text>
            <Kb.Icon type="release-5.4.0-pony" style={styles.ponyIcon} />
          </Kb.Box2>
          <Kb.Text type="BodySmall" allowFontScaling={true}>
            Keybase now supports custom emoji{' '}
            <Kb.Emoji allowFontScaling={true} size={Styles.globalMargins.small} emojiName=":sparkles:" />
          </Kb.Text>
        </Kb.Box2>
      </NewFeatureRow>
    </Version>
  )
}

export const LastLast = ({seen, onNavigate, onNavigateExternal}: VersionProps) => {
  return (
    <Version>
      <VersionTitle title="Previous releases" />
      <NewFeatureRow image="release-5.3.0-ipad" noSeparator={true} seen={seen}>
        Keybase for iPad is here!{' '}
        <Kb.Emoji allowFontScaling={true} size={Styles.globalMargins.small} emojiName=":sparkles:" /> Download
        it from the App Store.
      </NewFeatureRow>
      <NewFeatureRow image="release-5.3.0-open-teams" seen={seen}>
        You can now search for open teams using chat search
        {Platform.isElectron ? (Platform.isDarwin ? ` (⌘K)` : ` (ctrl-K)`) : null} in Chat.
      </NewFeatureRow>
      <NewFeatureRow
        image="release-5.2.0-crypto"
        noSeparator={true}
        onPrimaryButtonClick={() => {
          onNavigate({path: [{selected: Platform.isMobile ? cryptoTab : encryptTab}]})
        }}
        primaryButtonClassName="buttonNyctographicHover"
        primaryButtonText="Try it"
        seen={seen}
      >
        Encrypt, decrypt, sign, and verify all from within Keybase.{' '}
        <Kb.Emoji
          allowFontScaling={true}
          size={Styles.globalMargins.small}
          emojiName=":closed_lock_with_key:"
        />
      </NewFeatureRow>
      <NewFeatureRow
        seen={seen}
        image="release-5.2.0-bots"
        secondaryButtonText="Read more"
        onSecondaryButtonClick={() => {
          onNavigateExternal('https://keybase.io/blog/bots')
        }}
      >
        Bots: you can now install bots into your conversations. Kick off a meeting with Google Meet Bot, watch
        for commits with GitHub Bot, create new issues in JIRA, and more, all without leaving Keybase.
      </NewFeatureRow>
      <NewFeatureRow seen={seen} image="release-5.1.0-blocking">
        We heard you. You can now block and report spammers from the chat conversation or from people's
        profiles.
      </NewFeatureRow>
      <NewFeatureRow seen={seen} image="release-4.7.0-fast-user-switching">
        You can now quickly switch between all your signed in accounts from the user menu.
      </NewFeatureRow>
      <NewFeatureRow seen={seen} image="release-4.8.0-file-sync">
        Files: sync your favorite folders and have them available offline.
      </NewFeatureRow>
      <NewFeatureRow seen={seen} image="release-4.8.0-audio-messages">
        Chat: you can now send audio messages on mobile. Long press the mic and follow the magic. 🎙️
      </NewFeatureRow>
      <NewFeatureRow
        seen={seen}
        image="release-4.7.0-dark-mode"
        primaryButtonText="Open display settings"
        onPrimaryButtonClick={() => {
          onNavigate({path: [{selected: displayTab}]})
        }}
      >
        Dark mode is here! You can access theme settings under the Display section in Settings.
      </NewFeatureRow>
      <NewFeatureRow
        seen={seen}
        primaryButtonText="Try it"
        onPrimaryButtonClick={() => {
          onNavigate({
            path: [{props: {namespace: 'chat2', title: 'New chat'}, selected: 'chatNewChat'}],
          })
        }}
        secondaryButtonText="Read the doc"
        onSecondaryButtonClick={() => {
          onNavigateExternal('https://keybase.io/docs/chat/phones_and_emails')
        }}
      >
        You can now start a conversation with a phone number or email address.
        {` `}
        <Kb.Emoji allowFontScaling={true} size={Styles.globalMargins.small} emojiName=":phone:" />
      </NewFeatureRow>
      <NewFeatureRow seen={seen} image={'release-4.7.0-pinned-messages'}>
        Chat admins can now pin messages.
        {` `}
        <Kb.Emoji size={Styles.globalMargins.small} emojiName=":pushpin:" />
      </NewFeatureRow>
      <NewFeatureRow seen={seen} image={'release-4.7.0-keybase-fm'}>
        Listen to
        {` `}
        <Kb.Icon
          type="iconfont-radio"
          color={Styles.globalColors.black_50}
          boxStyle={styles.inlineIcon}
          sizeType={Styles.isMobile ? 'Small' : 'Default'}
        />
        {` `}
        <Kb.Text type="BodySmallSemibold">{keybaseFM}</Kb.Text>
        {` `}
        to get updates and new features.
      </NewFeatureRow>
    </Version>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  inlineIcon: Styles.platformStyles({
    isElectron: {
      display: 'inline-block',
      marginTop: Styles.globalMargins.xtiny,
    },
  }),
  ponyAlignment: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  ponyIcon: {marginLeft: Styles.globalMargins.tiny},
  roundedImage: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.grey,
      borderWidth: Styles.globalMargins.xxtiny,
    },
    isElectron: {
      // Pass borderRadius as a number to the image on mobile using collapseStyles
      borderRadius: '100%',
      borderStyle: 'solid',
    },
  }),
  versionTitle: {
    color: Styles.globalColors.black_50,
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.xsmall,
  },
}))
