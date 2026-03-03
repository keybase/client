import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {Animated as NativeAnimated, Easing as NativeEasing} from 'react-native'
// ios must animated plain colors not the dynamic ones
import colors, {darkColors} from '@/styles/colors'
import type {Props} from '.'
import {useColorScheme} from 'react-native'

// If this image changes, some hard coded dimensions
// in this file also need to change.
const explodedIllustrationURL =
  require('../../../../../images/icons/pattern-ashes-mobile-400-80.png') as number
const explodedIllustrationDarkURL =
  require('../../../../../images/icons/dark-pattern-ashes-mobile-400-80.png') as number

export const animationDuration = 1500

const ExplodingHeightRetainer = (p: Props) => {
  const {retainHeight, explodedBy, messageKey, style, children} = p
  const [height, setHeight] = React.useState(20)
  const onLayout = (evt: Kb.LayoutEvent) => {
    setHeight(evt.nativeEvent.layout.height)
  }
  const numImages = Math.ceil(height / 80)

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      onLayout={onLayout}
      style={Kb.Styles.collapseStyles([
        styles.container,
        style,
        retainHeight && styles.retaining,
        !!height && retainHeight && {height},
      ])}
    >
      {retainHeight ? null : children}
      <AnimatedAshTower
        exploded={retainHeight}
        explodedBy={explodedBy}
        messageKey={messageKey}
        numImages={numImages}
      />
    </Kb.Box2>
  )
}

type AshTowerProps = {
  exploded: boolean
  explodedBy?: string
  messageKey: string
  numImages: number
}

const AnimatedAshTower = (p: AshTowerProps) => {
  const {exploded, numImages, explodedBy} = p
  const [showExploded, setShowExploded] = React.useState(exploded)
  const [widthAV] = React.useState(new NativeAnimated.Value(exploded ? 100 : 0))

  const lastExplodedRef = React.useRef(exploded)
  React.useEffect(() => {
    if (lastExplodedRef.current === exploded) return
    lastExplodedRef.current = exploded
    if (exploded) {
      // just exploded! animate
      NativeAnimated.timing(widthAV, {
        duration: animationDuration,
        easing: NativeEasing.inOut(NativeEasing.ease),
        toValue: 100,
        useNativeDriver: false,
      }).start()
      // insert 'EXPLODED' in sync with 'boom!' disappearing
      const id = setTimeout(() => {
        setShowExploded(true)
      }, animationDuration)
      return () => {
        clearTimeout(id)
      }
    }
    return undefined
  }, [exploded, widthAV])

  const isDarkMode = useColorScheme() === 'dark'

  if (!exploded) {
    return null
  }
  const width = widthAV.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  })

  return (
    <NativeAnimated.View
      style={[{width}, styles.slider, {backgroundColor: isDarkMode ? darkColors.white : colors.white}]}
    >
      <AshTower showExploded={showExploded} explodedBy={explodedBy} numImages={numImages} />
      <EmojiTower animatedValue={widthAV} numImages={numImages} />
    </NativeAnimated.View>
  )
}

const EmojiTower = (p: {numImages: number; animatedValue: NativeAnimated.Value}) => {
  const {numImages, animatedValue} = p
  const [running, setRunning] = React.useState(false)
  const [force, setForce] = React.useState(0)

  const forceRender = C.useThrottledCallback(() => setForce(f => f + 1), 100)

  React.useEffect(() => {
    animatedValue.addListener((evt: {value: number}) => {
      if ([0, 100].includes(evt.value)) {
        setRunning(false)
        return
      }
      if (!running) {
        setRunning(true)
        return
      }
      forceRender()
    })
    return () => {
      animatedValue.removeAllListeners()
    }
  }, [animatedValue, running, forceRender])

  force // just to trigger

  const [children, setChildren] = React.useState<React.ReactNode>(null)

  React.useEffect(() => {
    if (!running) {
      setChildren(null)
      return
    }
    const children: Array<React.ReactNode> = []
    for (let i = 0; i < numImages * 4; i++) {
      const r = Math.random()
      let emoji: string
      if (Kb.Styles.isAndroid) {
        emoji = r < 0.5 ? '💥' : '💣'
      } else {
        if (r < 0.33) {
          emoji = '💥'
        } else if (r < 0.66) {
          emoji = '💣'
        } else {
          emoji = '🤯'
        }
      }
      children.push(
        <Kb.Text key={i} type="Body">
          {emoji}
        </Kb.Text>
      )
    }
    setChildren(children)
  }, [running, numImages])

  return <Kb.Box2 direction="vertical" overflow="hidden" style={styles.emojiTower}>{children}</Kb.Box2>
}

const AshTower = (p: {explodedBy?: string; numImages: number; showExploded: boolean}) => {
  const {numImages, showExploded, explodedBy} = p
  const isDarkMode = useColorScheme() === 'dark'
  const children: Array<React.ReactNode> = []
  for (let i = 0; i < numImages; i++) {
    children.push(
      <Kb.Image
        key={i}
        src={isDarkMode ? explodedIllustrationDarkURL : explodedIllustrationURL}
        style={styles.ashes}
      />
    )
  }
  let exploded: React.ReactNode = null

  if (showExploded) {
    exploded = !explodedBy ? (
      <Kb.Text type="BodyTiny" style={styles.exploded}>
        EXPLODED
      </Kb.Text>
    ) : (
      <Kb.Text lineClamp={1} type="BodyTiny" style={styles.exploded}>
        EXPLODED BY{' '}
        <Kb.ConnectedUsernames
          type="BodySmallBold"
          onUsernameClicked="profile"
          usernames={explodedBy}
          inline={true}
          colorFollowing={true}
          colorYou={true}
          underline={true}
        />
      </Kb.Text>
    )
  }
  return (
    <>
      {children}
      <Kb.Box2 direction="vertical" alignItems="flex-end" style={styles.tagBox}>{exploded}</Kb.Box2>
    </>
  )
}
const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      ashes: {
        height: 80,
        width: 400,
      },
      container: {flex: 1},
      emojiTower: {
        bottom: 0,
        position: 'absolute',
        right: 0,
        top: 0,
        width: 20,
      },
      exploded: {
        backgroundColor: Kb.Styles.globalColors.white,
        color: Kb.Styles.globalColors.black_20_on_white,
        paddingLeft: Kb.Styles.globalMargins.tiny,
      },
      retaining: {
        overflow: 'hidden',
      },
      slider: {
        bottom: 0,
        height: '100%',
        left: 0,
        overflow: 'hidden',
        position: 'absolute',
        top: 0,
      },
      tagBox: {
        bottom: 2,
        minWidth: 80,
        position: 'absolute',
        right: 0,
      },
    }) as const
)
export default ExplodingHeightRetainer
