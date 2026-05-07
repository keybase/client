import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from '.'
import {useColorScheme} from 'react-native'

export const animationDuration = 2000

const ExplodingHeightRetainer = (p: Props) => {
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
      <Ashes doneExploding={!animating} exploded={retainHeight} explodedBy={explodedBy} height={height} />
    </Kb.Box2>
  )
}

const Ashes = (props: {doneExploding: boolean; exploded: boolean; explodedBy?: string; height: number}) => {
  const {doneExploding, explodedBy, exploded, height} = props
  let explodedTag: React.ReactNode = null
  if (doneExploding) {
    explodedTag = explodedBy ? (
      <Kb.Text type="BodyTiny" style={styles.exploded}>
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
      <Kb.Text type="BodyTiny" style={styles.exploded} virtualText={true}>
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      ashBox: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white, // exploded messages don't have hover effects and we need to cover the message
          backgroundRepeat: 'repeat',
          backgroundSize: '400px 68px',
          bottom: 0,
          left: 0,
          position: 'absolute',
          top: 0,
        },
      }),
      container: {flex: 1},
      exploded: Kb.Styles.platformStyles({
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
      flame: {
        height: 17,
      },
      flameContainer: {
        position: 'absolute',
        right: -32,
        top: -22,
        width: 64,
      },
    }) as const
)

export default ExplodingHeightRetainer
