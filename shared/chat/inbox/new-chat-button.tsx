import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'

const HeaderNewChatButton = () => {
  const hide = Chat.useChatState(
    s =>
      s.inboxHasLoaded &&
      !!s.inboxLayout &&
      (s.inboxLayout.smallTeams || []).length === 0 &&
      (s.inboxLayout.bigTeams || []).length === 0
  )

  const onNewChat = C.useRouterState(s => s.appendNewChatBuilder)

  if (hide) return null

  return (
    <Kb.Box2
      direction="vertical"
      style={styles.rainbowButtonContainer}
      tooltip={`(${C.shortcutSymbol}N)`}
      className="tooltip-right"
    >
      <Kb.Box2 direction="vertical" style={styles.gradientContainer} pointerEvents="none">
        <Kb.Box style={styles.gradientRed} />
        <Kb.Box style={styles.gradientOrange} />
        <Kb.Box style={styles.gradientYellow} />
        <Kb.Box style={styles.gradientGreen} />
      </Kb.Box2>
      <Kb.Button
        label="New chat"
        mode="Primary"
        onClick={onNewChat}
        small={true}
        style={styles.rainbowButton}
        type="Default"
      />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      gradientContainer: Kb.Styles.platformStyles({
        isElectron: {
          height: '100%',
          position: 'absolute',
          width: '100%',
        },
        isMobile: {
          bottom: Kb.Styles.isAndroid ? 5 : 0,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        },
      }),
      gradientGreen: Kb.Styles.platformStyles({
        common: {
          backgroundColor: '#3AFFAC',
          borderBottomLeftRadius: Kb.Styles.borderRadius,
          borderBottomRightRadius: Kb.Styles.borderRadius,
          flex: 1,
        },
      }),
      gradientOrange: {backgroundColor: '#FFAC3D', flex: 1},
      gradientRed: Kb.Styles.platformStyles({
        common: {
          backgroundColor: '#FF5D5D',
          borderTopLeftRadius: Kb.Styles.borderRadius,
          borderTopRightRadius: Kb.Styles.borderRadius,
          flex: 1,
        },
      }),
      gradientYellow: {backgroundColor: '#FFF75A', flex: 1},
      rainbowButton: Kb.Styles.platformStyles({
        common: {
          margin: 2,
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
      }),
      rainbowButtonContainer: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          height: '100%',
          position: 'relative',
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDraggingClickable,
        },
      }),
    }) as const
)

export {HeaderNewChatButton}
export default HeaderNewChatButton
