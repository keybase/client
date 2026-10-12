import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {GlassView} from 'expo-glass-effect'
import {isEmptyInboxLayout, useInboxLayoutState} from './layout-state'

const rainbowHeight = isElectron ? 32 : 36
const rainbowWidth = 80
// the button's margin is the rainbow rim; it must be equal on all sides or the
// container radius can't stay concentric with the button's and the corners wobble
const rainbowRim = 2
const rainbowRadius = Kb.Styles.borderRadius + rainbowRim
const glassRim = 4
const glassRadius = rainbowRadius + glassRim
const colorBarCommon = {
  height: rainbowHeight / 4,
  position: 'absolute',
  width: '100%',
} as const

const HeaderNewChatButton = () => {
  const styles = useStyles()
  // mobile's empty inbox draws its own big 'Start a new chat' button, so the header one is
  // redundant there; desktop has no such affordance and must keep it
  const hide = useInboxLayoutState(s => isMobile && s.hasLoaded && isEmptyInboxLayout(s.layout))

  const onNewChat = C.Router2.appendNewChatBuilder

  if (hide) return null

  const rainbowButton = (
    <Kb.Box2 alignSelf="center"
      direction="vertical"
      style={styles.rainbowButtonContainer}
      tooltip={`(${C.shortcutSymbol}N)`}
      className="tooltip-right"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      relative={true}
    >
      <Kb.Box2 alignSelf="center" direction="vertical" style={styles.gradientRed} />
      <Kb.Box2 alignSelf="center" direction="vertical" style={styles.gradientOrange} />
      <Kb.Box2 alignSelf="center" direction="vertical" style={styles.gradientYellow} />
      <Kb.Box2 alignSelf="center" direction="vertical" style={styles.gradientGreen} />
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

  if (C.isLiquidGlassSupported) {
    return (
      <GlassView isInteractive={true} glassEffectStyle="regular" style={styles.glass}>
        {rainbowButton}
      </GlassView>
    )
  }

  return rainbowButton
}

const calcBarTop = (index: number) => index * colorBarCommon.height

const useStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      glass: {
        alignItems: 'center',
        alignSelf: 'center',
        borderRadius: glassRadius,
        height: rainbowHeight + glassRim * 2,
        justifyContent: 'center',
        padding: glassRim,
      },
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
        margin: rainbowRim,
        ...Kb.Styles.paddingH(Kb.Styles.globalMargins.tiny),
      },
      rainbowButtonContainer: Kb.Styles.platformStyles({
        common: {
          borderRadius: Kb.Styles.borderRadius,
          height: rainbowHeight,
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDraggingClickable,
          width: rainbowWidth,
        },
        isMobile: {
          alignSelf: 'center',
          borderRadius: rainbowRadius,
        },
      }),
    }) as const
)

export {HeaderNewChatButton}
export default HeaderNewChatButton
