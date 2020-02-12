import * as React from 'react'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as Styles from '../../../../../styles'
import * as Kb from '../../../../../common-adapters'

function renderWelcomeMessage(message: RPCChatTypes.WelcomeMessage, cannotWrite: boolean): React.ReactNode {
  if (message.set) {
    return (
      <Kb.Text style={styles.text} type="BodySmall">
        {message.text}
      </Kb.Text>
    )
  } else if (cannotWrite) {
    return (
      <Kb.Text style={styles.text} type="BodySmall">
        <Kb.Emoji allowFontScaling={true} size={Styles.globalMargins.small} emojiName=":wave:" /> Welcome to
        the team!
      </Kb.Text>
    )
  } else {
    return (
      <Kb.Text style={styles.text} type="BodySmall">
        <Kb.Emoji allowFontScaling={true} size={Styles.globalMargins.small} emojiName=":wave:" /> Welcome to
        the team! Say hi to everyone and introduce yourself.
      </Kb.Text>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  text: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-word',
    },
  }),
}))

const buttonSpace = 6

const stylesMaker = (electronMarginLeft, nativeMarginLeft, electronAvatarMarginTop) =>
  Styles.styleSheetCreate(
    () =>
      ({
        actionsBox: Styles.platformStyles({
          common: {
            marginTop: Styles.globalMargins.tiny - buttonSpace,
          },
          isElectron: {
            flexWrap: 'wrap',
          },
        }),
        authorContainer: Styles.platformStyles({
          common: {
            alignItems: 'flex-start',
            alignSelf: 'flex-start',
            height: Styles.globalMargins.mediumLarge,
          },
          isMobile: {marginTop: 8},
        }),
        avatar: Styles.platformStyles({
          isElectron: {
            marginLeft: electronMarginLeft,
            marginTop: electronAvatarMarginTop,
          },
          isMobile: {marginLeft: nativeMarginLeft},
        }),
        bottomLine: {
          ...Styles.globalStyles.flexGrow,
          alignItems: 'baseline',
        },
        buttonSpace: {
          marginTop: buttonSpace,
        },
        content: Styles.platformStyles({
          isElectron: {
            marginTop: -16,
          },
          isMobile: {
            marginTop: -12,
            paddingBottom: 3,
          },
        }),
        contentHorizontalPad: Styles.platformStyles({
          isElectron: {
            paddingLeft:
              // Space for below the avatar
              Styles.globalMargins.tiny + // right margin
              electronMarginLeft + // left margin
              Styles.globalMargins.mediumLarge, // avatar
            paddingRight: Styles.globalMargins.tiny,
          },
          isMobile: {
            paddingLeft:
              // Space for below the avatar
              Styles.globalMargins.tiny + // right margin
              nativeMarginLeft + // left margin
              Styles.globalMargins.mediumLarge, // avatar
          },
        }),
        contentWithImage: {
          minHeight: 70,
        },
        image: Styles.platformStyles({
          common: {
            position: 'absolute',
            top: 0,
          },
          isElectron: {
            left: '50%',
            marginLeft: 15,
          },
          isMobile: {
            right: 40,
          },
        }),
        teamnameText: Styles.platformStyles({
          common: {
            color: Styles.globalColors.black,
          },
        }),
        text: {
          maxWidth: '45%',
        },
      } as const)
  )

const teamJourneyStyles = stylesMaker(
  Styles.globalMargins.small,
  Styles.globalMargins.tiny,
  Styles.globalMargins.xtiny
)

export {renderWelcomeMessage, stylesMaker, teamJourneyStyles}
