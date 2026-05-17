import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {Animated as NativeAnimated, Easing as NativeEasing} from 'react-native'
import colors, {darkColors} from '@/styles/colors'
import type {Props} from './index.shared'
import {useColorScheme} from 'react-native'

export const animationDuration = isMobile ? 1500 : 2000

// Mobile: static ash tile images
const explodedIllustrationURL =
  require('../../../../../images/icons/pattern-ashes-mobile-400-80.png') as number
const explodedIllustrationDarkURL =
  require('../../../../../images/icons/dark-pattern-ashes-mobile-400-80.png') as number

// Desktop implementation
const DesktopExplodingHeightRetainer = (p: Props) => {
  const {retainHeight, explodedBy, style, children, messageKey} = p
  const [animationState, setAnimationState] = React.useState(() => ({
    animationKey: undefined as string | undefined,
    doneKey: retainHeight ? messageKey : undefined,
    retainHeight,
  }))
  const [height, setHeight] = React.useState(17)

  let currentAnimationState = animationState
  if (animationState.retainHeight !== retainHeight) {
    currentAnimationState = {
      animationKey: retainHeight ? messageKey : undefined,
      doneKey: retainHeight ? undefined : animationState.doneKey,
      retainHeight,
    }
    setAnimationState(currentAnimationState)
  }
  const animating =
    retainHeight &&
    currentAnimationState.animationKey === messageKey &&
    currentAnimationState.doneKey !== messageKey

  React.useEffect(() => {
    if (!animating) {
      return undefined
    }
    const timerID = setTimeout(() => {
      setAnimationState(state =>
        state.animationKey === messageKey ? {...state, doneKey: messageKey} : state
      )
    }, animationDuration)
    return () => {
      clearTimeout(timerID)
    }
  }, [animating, messageKey])

  const setBoxRef = React.useCallback((ref: Kb.MeasureRef | null) => {
    const measuredHeight = ref?.getBoundingClientRect().height
    if (measuredHeight) {
      setHeight(lastHeight => (lastHeight === measuredHeight ? lastHeight : measuredHeight))
    }
  }, [])

  return (
    <Kb.Box2
      direction="vertical"
      style={Kb.Styles.collapseStyles([
        styles.container,
        style,
        // paddingRight is to compensate for the message menu
        // to make sure we don't rewrap text when showing the animation
        retainHeight && {
          height,
          paddingRight: 28,
          position: 'relative',
        },
      ])}
      ref={setBoxRef}
    >
      {retainHeight ? null : children}
      <DesktopAshes
        doneExploding={!animating}
        exploded={retainHeight}
        explodedBy={explodedBy}
        height={height}
      />
    </Kb.Box2>
  )
}

const DesktopAshes = (props: {
  doneExploding: boolean
  exploded: boolean
  explodedBy?: string
  height: number
}) => {
  const {doneExploding, explodedBy, exploded, height} = props
  let explodedTag: React.ReactNode = null
  if (doneExploding) {
    explodedTag = explodedBy ? (
      <Kb.Text type="BodyTiny" style={styles.explodedDesktop}>
        <Kb.Text type="BodyTiny" virtualText={true}>
          {'EXPLODED BY '}
        </Kb.Text>
        <Kb.ConnectedUsernames
          type="BodySmallBold"
          onUsernameClicked="profile"
          usernames={explodedBy}
          inline={true}
          colorFollowing={true}
          colorYou={true}
          underline={true}
          virtualText={true}
        />
      </Kb.Text>
    ) : (
      <Kb.Text type="BodyTiny" style={styles.explodedDesktop} virtualText={true}>
        EXPLODED
      </Kb.Text>
    )
  }

  return (
    <div
      className={Kb.Styles.classNames('ashbox', 'ashes-bg', {'full-width': exploded})}
      style={Kb.Styles.castStyleDesktop(Kb.Styles.collapseStyles([styles.ashBox]))}
    >
      {exploded && explodedTag}
      <FlameFront height={height} stop={doneExploding} />
    </div>
  )
}

function FlameFront(props: {height: number; stop: boolean}) {
  const isDarkMode = useColorScheme() === 'dark'
  if (props.stop) {
    return null
  }
  const numBoxes = Math.max(Math.ceil(props.height / 17) - 1, 1)
  const children: Array<React.ReactNode> = []
  for (let i = 0; i < numBoxes; i++) {
    children.push(
      <Kb.Box2 direction="vertical" key={String(i)} style={styles.flame}>
        <Kb.Animation animationType={isDarkMode ? 'darkExploding' : 'exploding'} width={64} height={64} />
      </Kb.Box2>
    )
  }
  return (
    <Kb.Box2 direction="vertical" className="flame-container" style={styles.flameContainer}>
      {children}
    </Kb.Box2>
  )
}

// Native implementation
const NativeExplodingHeightRetainer = (p: Props) => {
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
      NativeAnimated.timing(widthAV, {
        duration: animationDuration,
        easing: NativeEasing.inOut(NativeEasing.ease),
        toValue: 100,
        useNativeDriver: false,
      }).start()
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

const makeEmojiTowerChildren = (numImages: number) => {
  const children: Array<React.ReactNode> = []
  for (let i = 0; i < numImages * 4; i++) {
    const r = Math.random()
    let emoji: string
    if (isAndroid) {
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
  return children
}

const EmojiTower = (p: {numImages: number; animatedValue: NativeAnimated.Value}) => {
  const {numImages, animatedValue} = p
  const runningRef = React.useRef(false)
  const [, setForce] = React.useState(0)
  const [children, setChildren] = React.useState<React.ReactNode>(null)

  const forceRender = C.useThrottledCallback(() => setForce(f => f + 1), 100)

  React.useEffect(() => {
    animatedValue.addListener((evt: {value: number}) => {
      if ([0, 100].includes(evt.value)) {
        runningRef.current = false
        setChildren(null)
        return
      }
      if (!runningRef.current) {
        runningRef.current = true
        setChildren(makeEmojiTowerChildren(numImages))
        return
      }
      forceRender()
    })
    return () => {
      runningRef.current = false
      animatedValue.removeAllListeners()
    }
  }, [animatedValue, forceRender, numImages])

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
      <Kb.Text type="BodyTiny" style={styles.explodedNative}>
        EXPLODED
      </Kb.Text>
    ) : (
      <Kb.Text lineClamp={1} type="BodyTiny" style={styles.explodedNative}>
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

const ExplodingHeightRetainer = (p: Props) => {
  if (!isMobile) return <DesktopExplodingHeightRetainer {...p} />
  return <NativeExplodingHeightRetainer {...p} />
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      ashBox: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white,
          backgroundRepeat: 'repeat',
          backgroundSize: '400px 68px',
          bottom: 0,
          left: 0,
          position: 'absolute',
          top: 0,
        },
      }),
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
      explodedDesktop: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white,
          bottom: 0,
          color: Kb.Styles.globalColors.black_20_on_white,
          padding: 2,
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingTop: 0,
          position: 'absolute',
          right: 0,
          whiteSpace: 'nowrap',
        },
      }),
      explodedNative: {
        backgroundColor: Kb.Styles.globalColors.white,
        color: Kb.Styles.globalColors.black_20_on_white,
        paddingLeft: Kb.Styles.globalMargins.tiny,
      },
      flame: {
        height: 17,
      },
      flameContainer: {
        position: 'absolute',
        right: -32,
        top: -22,
        width: 64,
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
