import * as Kb from '@/common-adapters'

type Props = {
  onBack: () => void
  onNewChat: () => void
}

const StartNewChat = (props: Props) => {
  if (Kb.Styles.isMobile) {
    return (
      <Kb.Box style={styles.container}>
        <Kb.ClickableBox style={styles.clickableBox} onClick={props.onNewChat}>
          <Kb.Icon type="iconfont-compose" style={styles.iconCompose} hoverColor="inital" />
          <Kb.Text type="BodyBigLink" style={{margin: Kb.Styles.globalMargins.tiny}}>
            Start a new chat
          </Kb.Text>
        </Kb.ClickableBox>
      </Kb.Box>
    )
  }
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <Kb.Button label="Start a new chat" onClick={props.onNewChat} style={styles.button} small={true} />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      backButton: {
        left: 0,
        position: 'absolute',
        top: Kb.Styles.globalMargins.xxtiny,
      },
      button: Kb.Styles.platformStyles({
        common: {
          flexGrow: 1,
          marginLeft: Kb.Styles.globalMargins.small,
          marginRight: Kb.Styles.globalMargins.small,
        },
        isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
      }),
      buttonIcon: {
        marginRight: Kb.Styles.globalMargins.tiny,
      },
      clickableBox: {
        alignItems: 'center',
        flexDirection: 'row',
      },
      container: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        backgroundColor: Kb.Styles.isMobile
          ? Kb.Styles.globalColors.fastBlank
          : Kb.Styles.globalColors.blueGrey,
        justifyContent: 'center',
        minHeight: 48,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
        position: 'relative',
      },
      iconCompose: Kb.Styles.platformStyles({
        common: {
          color: Kb.Styles.globalColors.blueDark,
        },
        isElectron: {
          fontSize: 16,
        },
        isMobile: {
          fontSize: 20,
          padding: Kb.Styles.globalMargins.xtiny,
        },
      }),
      rabbitEmoji: {
        marginLeft: Kb.Styles.globalMargins.xtiny,
      },
      startNewChatText: {
        color: Kb.Styles.globalColors.white,
      },
    }) as const
)

export default StartNewChat
