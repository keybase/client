import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {UploadProps} from './upload.shared'
import {Animated as NativeAnimated, Easing as NativeEasing, useColorScheme} from 'react-native'
import capitalize from 'lodash/capitalize'
import './upload.css'

type DrawState = 'showing' | 'hiding' | 'hidden'
type AnimationState = {
  hideComplete: boolean
  lastShowing: boolean
}

const easing = NativeEasing.bezier(0.13, 0.72, 0.31, 0.95)

const Upload = (props: UploadProps) => {
  const {smallMode, showing: _showing, files, fileName, totalSyncingBytes, timeLeft, debugToggleShow} = props

  // Desktop animation state
  const [animationState, setAnimationState] = React.useState<AnimationState>(() => ({
    hideComplete: !_showing,
    lastShowing: _showing,
  }))

  // Native animation state
  const [backgroundTop] = React.useState(new NativeAnimated.Value(0))
  const [uploadTop] = React.useState(new NativeAnimated.Value(48))
  const [nativeShowing, setNativeShowing] = React.useState(false)
  const animationsRef = React.useRef({
    in: undefined as NativeAnimated.CompositeAnimation | undefined,
    loop: undefined as NativeAnimated.CompositeAnimation | undefined,
    out: undefined as NativeAnimated.CompositeAnimation | undefined,
  })
  const mountedRef = React.useRef(false)
  const isDarkMode = useColorScheme() === 'dark'

  // Derive desktop draw state; update on showing change (setState-during-render pattern)
  let desktopHideComplete = animationState.hideComplete
  if (!Kb.Styles.isMobile && animationState.lastShowing !== _showing) {
    desktopHideComplete = false
    setAnimationState({hideComplete: false, lastShowing: _showing})
  }

  // Desktop: delay hiding until animation completes
  React.useEffect(() => {
    if (Kb.Styles.isMobile || _showing || desktopHideComplete) return
    const id = setTimeout(() => {
      setAnimationState(s => (s.lastShowing === _showing ? {...s, hideComplete: true} : s))
    }, 300)
    return () => clearTimeout(id)
  }, [desktopHideComplete, _showing])

  // Native: show/hide animation
  React.useEffect(() => {
    if (!Kb.Styles.isMobile) return
    mountedRef.current = true
    const stopAnimation = (animation: keyof typeof animationsRef.current) => {
      const a = animationsRef.current[animation]
      if (!a) return
      a.stop()
      animationsRef.current[animation] = undefined
    }
    const stopAllAnimations = () => {
      stopAnimation('out')
      stopAnimation('loop')
      stopAnimation('in')
    }
    const startAnimationLoop = () => {
      const loop = NativeAnimated.loop(
        NativeAnimated.timing(backgroundTop, {
          duration: 2000,
          easing: NativeEasing.linear,
          toValue: -80,
          useNativeDriver: false,
        })
      )
      animationsRef.current.loop = loop
      loop.start()
    }
    const startAnimationIn = () => {
      const ain = NativeAnimated.timing(uploadTop, {
        duration: 300,
        easing,
        toValue: 0,
        useNativeDriver: false,
      })
      animationsRef.current.in = ain
      ain.start()
    }
    const startAnimationOut = (cbIfFinish: () => void) => {
      const out = NativeAnimated.timing(uploadTop, {
        duration: 300,
        easing,
        toValue: 48,
        useNativeDriver: false,
      })
      animationsRef.current.out = out
      out.start(({finished}) => finished && cbIfFinish())
    }
    const enter = () => {
      stopAllAnimations()
      setNativeShowing(true)
      startAnimationIn()
      startAnimationLoop()
    }
    const exit = () => {
      stopAnimation('in')
      startAnimationOut(() => {
        stopAnimation('loop')
        if (mountedRef.current) setNativeShowing(false)
      })
    }
    if (_showing) {
      enter()
    } else {
      exit()
    }
    return () => {
      stopAllAnimations()
      mountedRef.current = false
    }
  }, [_showing, backgroundTop, uploadTop])

  if (!Kb.Styles.isMobile) {
    const drawState: DrawState = _showing ? 'showing' : desktopHideComplete ? 'hidden' : 'hiding'
    const height = 40
    const offset = smallMode && C.isDarwin ? 13 : 0

    return (
      <>
        {!!debugToggleShow && (
          <Kb.Button
            onClick={debugToggleShow}
            label="Toggle"
            style={Kb.Styles.collapseStyles([styles.toggleButton, {bottom: height}])}
          />
        )}
        {drawState !== 'hidden' && (
          <Kb.Box2
            direction="vertical"
            centerChildren={true}
            className="upload-animation-loop upload-bg"
            fullWidth={true}
            style={Kb.Styles.collapseStyles([
              styles.stylesBox,
              {bottom: _showing ? offset : offset - height, height, maxHeight: height},
            ])}
          >
            {smallMode ? (
              <Kb.Text key="files" type="BodySemibold" style={styles.textOverflow} lineClamp={1}>
                {files
                  ? fileName
                    ? `Encrypting ${fileName}.`
                    : `Encrypting ${files} items.`
                  : totalSyncingBytes
                    ? 'Encrypting items.'
                    : 'Done!'}
                {timeLeft ? ` ${capitalize(timeLeft)} left` : ''}
              </Kb.Text>
            ) : (
              <>
                <Kb.Text key="files" type="BodySemibold" style={styles.textOverflow}>
                  {files
                    ? fileName
                      ? `Encrypting and updating ${fileName}...`
                      : `Encrypting and updating ${files} items...`
                    : totalSyncingBytes
                      ? 'Encrypting and updating items...'
                      : 'Done!'}
                </Kb.Text>
                {!!timeLeft.length && (
                  <Kb.Text key="left" type="BodySmall" style={styles.stylesText}>{`${timeLeft} left`}</Kb.Text>
                )}
              </>
            )}
          </Kb.Box2>
        )}
      </>
    )
  }

  return (
    <>
      {!!debugToggleShow && <Kb.Button onClick={debugToggleShow} label="Toggle" />}
      {nativeShowing && (
        <NativeAnimated.View style={{position: 'relative', top: uploadTop}}>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.backgroundBox}>
            <NativeAnimated.Image
              resizeMode="repeat"
              source={isDarkMode
                ? (require('../../images/dark-upload-pattern-80.png') as number)
                : (require('../../images/upload-pattern-80.png') as number)}
              style={{...styles.backgroundImage, marginTop: backgroundTop}}
            />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.box}>
            <Kb.Text key="files" type="BodySmallSemibold" style={styles.text}>
              {files
                ? `Encrypting and uploading ${files} files...`
                : totalSyncingBytes
                  ? 'Encrypting and uploading...'
                  : 'Done!'}
            </Kb.Text>
            {!!timeLeft.length && (
              <Kb.Text key="left" type="BodyTiny" style={styles.text}>{`${timeLeft} left`}</Kb.Text>
            )}
          </Kb.Box2>
        </NativeAnimated.View>
      )}
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      backgroundBox: Kb.Styles.platformStyles({
        common: {
          height: 48,
          overflow: 'hidden',
        },
      }),
      backgroundImage: {
        height: 160,
        width: '100%',
      },
      box: {
        height: 48,
        marginTop: -48,
      },
      stylesBox: Kb.Styles.platformStyles({
        isElectron: {
          flexShrink: 0,
          paddingLeft: Kb.Styles.globalMargins.medium,
          paddingRight: Kb.Styles.globalMargins.medium,
          position: 'absolute',
        },
      }),
      stylesText: {
        color: Kb.Styles.globalColors.whiteOrWhite,
      },
      text: {
        color: Kb.Styles.globalColors.whiteOrWhite,
      },
      textOverflow: Kb.Styles.platformStyles({
        isElectron: {
          color: Kb.Styles.globalColors.whiteOrWhite,
          maxWidth: '100%',
          overflow: 'hidden',
          textAlign: 'center',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      toggleButton: {position: 'absolute'},
    }) as const
)

export default Upload
