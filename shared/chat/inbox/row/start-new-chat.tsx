import * as Kb from '@/common-adapters'

type Props = {
  onBack: () => void
  onNewChat: () => void
}

const StartNewChat = (props: Props) => {
  if (Kb.Styles.isMobile) {
    return (
      <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} justifyContent="center" style={styles.container} relative={true}>
        <Kb.ClickableBox2 style={styles.clickableBox} onClick={props.onNewChat}>
          <Kb.Icon2 type="iconfont-compose" style={styles.iconCompose} />
          <Kb.Text type="BodyBigLink" style={{margin: Kb.Styles.globalMargins.tiny}}>
            Start a new chat
          </Kb.Text>
        </Kb.ClickableBox2>
      </Kb.Box2>
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
      button: Kb.Styles.platformStyles({
        common: {
          flexGrow: 1,
          marginLeft: Kb.Styles.globalMargins.small,
          marginRight: Kb.Styles.globalMargins.small,
        },
        isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
      }),
      clickableBox: {
        alignItems: 'center',
        flexDirection: 'row',
      },
      container: {
        backgroundColor: Kb.Styles.isMobile
          ? undefined
          : Kb.Styles.globalColors.blueGrey,
        minHeight: 48,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
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
    }) as const
)

export default StartNewChat
