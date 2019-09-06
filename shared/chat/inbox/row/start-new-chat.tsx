import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import Flags from '../../../util/feature-flags'

type Props = {
  onBack: () => void
  onNewChat: () => void
}

const StartNewChat = (props: Props) => {
  if (Styles.isMobile) {
    return (
      <Kb.Box style={styles.container}>
        <Kb.ClickableBox style={styles.clickableBox} onClick={props.onNewChat}>
          <Kb.Icon
            type="iconfont-compose"
            style={Kb.iconCastPlatformStyles(styles.iconCompose)}
            hoverColor="inital"
          />
          <Kb.Text type="BodyBigLink" style={{margin: Styles.globalMargins.tiny}}>
            Start a new chat
          </Kb.Text>
        </Kb.ClickableBox>
      </Kb.Box>
    )
  }
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.Button onClick={props.onNewChat} style={styles.button} small={true}>
        <Kb.Text type="BodyBig" style={styles.startNewChatText}>
          Start a new chat
        </Kb.Text>
        {Flags.wonderland && (
          <Kb.Text type="BodyBig" style={styles.rabbitEmoji}>
            <Kb.Emoji size={16} emojiName=":rabbit2:" />
          </Kb.Text>
        )}
      </Kb.Button>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      backButton: {
        left: 0,
        position: 'absolute',
        top: Styles.globalMargins.xxtiny,
      },
      button: {
        flexGrow: 1,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
      },
      buttonIcon: {
        marginRight: Styles.globalMargins.tiny,
      },
      clickableBox: {
        alignItems: 'center',
        flexDirection: 'row',
      },
      container: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        backgroundColor: Styles.isMobile ? Styles.globalColors.fastBlank : Styles.globalColors.blueGrey,
        justifyContent: 'center',
        minHeight: 48,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
        position: 'relative',
      },
      iconCompose: Styles.platformStyles({
        common: {
          color: Styles.globalColors.blueDark,
        },
        isElectron: {
          fontSize: 16,
        },
        isMobile: {
          fontSize: 20,
          padding: Styles.globalMargins.xtiny,
        },
      }),
      rabbitEmoji: {
        marginLeft: Styles.globalMargins.xtiny,
      },
      startNewChatText: {
        color: Styles.globalColors.white,
      },
    } as const)
)

export default StartNewChat
