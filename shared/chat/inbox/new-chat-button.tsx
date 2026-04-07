import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import {LiquidGlassView, isLiquidGlassSupported} from '@callstack/liquid-glass'

const rainbowHeight = C.isElectron ? 32 : 36
const rainbowWidth = C.isElectron ? 80 : 96
const colorBarCommon = {
  height: rainbowHeight / 4,
  position: 'absolute',
  width: '100%',
} as const

const HeaderNewChatButton = () => {
  const hide = Chat.useChatState(
    s =>
      s.inboxHasLoaded &&
      !!s.inboxLayout &&
      (s.inboxLayout.smallTeams || []).length === 0 &&
      (s.inboxLayout.bigTeams || []).length === 0
  )

  const onNewChat = C.Router2.appendNewChatBuilder

  if (hide) return null

  const rainbowButton = (
    <Kb.Box2
      direction="vertical"
      style={styles.rainbowButtonContainer}
      tooltip={`(${C.shortcutSymbol}N)`}
      className="tooltip-right"
      alignItems="center"
      justifyContent="center"
    >
      <Kb.Box2 direction="vertical" style={styles.gradientRed} />
      <Kb.Box2 direction="vertical" style={styles.gradientOrange} />
      <Kb.Box2 direction="vertical" style={styles.gradientYellow} />
      <Kb.Box2 direction="vertical" style={styles.gradientGreen} />
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

  // eslint-disable-next-line
  if (C.isIOS && isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        interactive={true}
        effect={'regular'}
        style={{
          alignContent: 'center',
          borderRadius: 8,
          height: rainbowHeight,
          justifyContent: 'center',
          padding: 8,
          width: rainbowWidth,
        }}
      >
        {rainbowButton}
      </LiquidGlassView>
    )
  }

  return rainbowButton
}

const calcBarTop = (index: number) => index * colorBarCommon.height

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      gradientGreen: {
        ...colorBarCommon,
        backgroundColor: '#3AFFAC',
        top: calcBarTop(3),
      },
      gradientOrange: {
        ...colorBarCommon,
        backgroundColor: '#FFAC3D',
        top: calcBarTop(1),
      },
      gradientRed: {
        ...colorBarCommon,
        backgroundColor: '#FF5D5D',
        top: calcBarTop(0),
      },
      gradientYellow: {
        ...colorBarCommon,
        backgroundColor: '#FFF75A',
        top: calcBarTop(2),
      },
      rainbowButton: {
        margin: 2,
        paddingLeft: Kb.Styles.globalMargins.tiny,
        paddingRight: Kb.Styles.globalMargins.tiny,
      },
      rainbowButtonContainer: Kb.Styles.platformStyles({
        common: {
          borderRadius: Kb.Styles.borderRadius,
          height: rainbowHeight,
          overflow: 'hidden',
          position: 'relative',
          width: rainbowWidth,
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDraggingClickable,
        },
      }),
    }) as const
)

export {HeaderNewChatButton}
export default HeaderNewChatButton
