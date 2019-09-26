import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {accountTab, displayTab, contactsTab} from '../constants/settings'
import NewFeatureRow from './new-feature-row'

/* Include images */
/* const imageName = require('../images/release/MAJ.MIN.PATCH/name.png') */
const pinnedMessageImage = require('../images/releases/4.7.0/pinned-message.png')
const darkModeImage = require('../images/releases/4.7.0/dark-mode.png')

export type VersionProps = {
  seen: boolean
  onNavigate: (props: {}, selected: string) => void
  onNavigateExternal: (url: string) => void
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
    <Kb.Text type="BodySemibold" style={styles.versionTitle}>
      {title}
    </Kb.Text>
  </Kb.Box2>
)

export const Current = ({seen, onNavigate, onNavigateExternal}: VersionProps) => {
  return (
    <Version>
      <NewFeatureRow
        noSeparator={true}
        seen={seen}
        image={darkModeImage}
        primaryButtonText="Go dark"
        onPrimaryButtonClick={() => {
          onNavigate({fromKey: accountTab}, displayTab)
        }}
      >
        Dark mode is here! You can access theme settings under the Display section of settings.
      </NewFeatureRow>
      <NewFeatureRow
        seen={seen}
        primaryButtonText={Styles.isMobile ? 'Try it' : 'Read the doc'}
        onPrimaryButtonClick={() => {
          Styles.isMobile
            ? onNavigate({}, contactsTab)
            : onNavigateExternal('https://keybase.io/docs/chat/phones_and_emails')
        }}
        secondaryButtonText={Styles.isMobile ? 'Read the doc' : undefined}
        onSecondaryButtonClick={() => {
          Styles.isMobile && onNavigateExternal('https://keybase.io/docs/chat/phones_and_emails')
        }}
      >
        You can now start a conversation with a phone number or email address.
        {` `}
        <Kb.Emoji allowFontScaling={true} size={Styles.globalMargins.small} emojiName=":phone:" />
      </NewFeatureRow>
      <NewFeatureRow
        seen={seen}
        image={pinnedMessageImage}
        imageStyle={Styles.collapseStyles([
          styles.roundedImage,
          // Need to set fixed width on native to get image width not to be set to maxWidth
          Styles.isMobile && {borderRadius: 150, width: 150},
        ])}
      >
        Chat admins can now pin messages.
        {` `}
        <Kb.Emoji size={Styles.globalMargins.small} emojiName=":pushpin:" />
      </NewFeatureRow>
    </Version>
  )
}

export const Last = (_: VersionProps) => {
  return (
    <Version>
      <VersionTitle title="Last Release" />
    </Version>
  )
}

export const LastLast = (_: VersionProps) => {
  return (
    <Version>
      <VersionTitle title="Last Last Release" />
    </Version>
  )
}

const styles = Styles.styleSheetCreate(() => ({
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
