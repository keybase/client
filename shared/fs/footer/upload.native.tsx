import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type {UploadProps} from './upload'
import {Animated as NativeAnimated, Easing as NativeEasing} from 'react-native'

const lightPatternImage = require('../../images/upload-pattern-80.png') as number
const darkPatternImage = require('../../images/dark-upload-pattern-80.png') as number

const easing = NativeEasing.bezier(0.13, 0.72, 0.31, 0.95)

const Upload = (props: UploadProps) => {
  const {showing: _showing, files, totalSyncingBytes, timeLeft, debugToggleShow} = props
  const [backgroundTop] = React.useState(new NativeAnimated.Value(0))
  const [uploadTop] = React.useState(new NativeAnimated.Value(48))
  const [showing, setShowing] = React.useState(false)
  const animationsRef = React.useRef({
    in: undefined as NativeAnimated.CompositeAnimation | undefined,
    loop: undefined as NativeAnimated.CompositeAnimation | undefined,
    out: undefined as NativeAnimated.CompositeAnimation | undefined,
  })
  const mountedRef = React.useRef(false)

  const startAnimationLoop = React.useCallback(() => {
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
  }, [backgroundTop])

  const startAnimationIn = React.useCallback(() => {
    const ain = NativeAnimated.timing(uploadTop, {
      duration: 300,
      easing,
      toValue: 0,
      useNativeDriver: false,
    })
    animationsRef.current.in = ain
    ain.start()
  }, [uploadTop])

  const startAnimationOut = React.useCallback(
    (cbIfFinish: () => void) => {
      const out = NativeAnimated.timing(uploadTop, {
        duration: 300,
        easing,
        toValue: 48,
        useNativeDriver: false,
      })
      animationsRef.current.out = out
      out.start(({finished}) => finished && cbIfFinish())
    },
    [uploadTop]
  )

  const stopAnimation = React.useCallback((animation: keyof typeof animationsRef.current) => {
    const a = animationsRef.current[animation]
    if (!a) return
    a.stop()
    animationsRef.current[animation] = undefined
  }, [])

  const stopAllAnimations = React.useCallback(() => {
    stopAnimation('out')
    stopAnimation('loop')
    stopAnimation('in')
  }, [stopAnimation])

  const enter = React.useCallback(() => {
    stopAllAnimations()
    setShowing(true)
    startAnimationIn()
    startAnimationLoop()
  }, [startAnimationIn, startAnimationLoop, stopAllAnimations])

  const exit = React.useCallback(() => {
    stopAnimation('in')
    startAnimationOut(() => {
      stopAnimation('loop')
      if (mountedRef.current) setShowing(false)
    })
  }, [startAnimationOut, stopAnimation])

  React.useEffect(() => {
    mountedRef.current = true
    if (_showing) {
      enter()
    }
    return () => {
      stopAllAnimations()
      mountedRef.current = false
    }
  }, [enter, _showing, stopAllAnimations])

  React.useEffect(() => {
    if (_showing) {
      enter()
    } else {
      exit()
    }
  }, [enter, exit, _showing])

  const isDarkMode = C.useDarkModeState(s => s.isDarkMode())
  return (
    <>
      {!!debugToggleShow && <Kb.Button onClick={debugToggleShow} label="Toggle" />}
      {showing && (
        <NativeAnimated.View style={{position: 'relative', top: uploadTop}}>
          <Kb.Box style={styles.backgroundBox}>
            <NativeAnimated.Image
              resizeMode="repeat"
              source={isDarkMode ? darkPatternImage : lightPatternImage}
              style={{...styles.backgroundImage, marginTop: backgroundTop}}
            />
          </Kb.Box>
          <Kb.Box style={styles.box}>
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
          </Kb.Box>
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
          width: '100%',
        },
      }),
      backgroundImage: {
        height: 160,
        width: '100%',
      },
      box: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        height: 48,
        justifyContent: 'center',
        marginTop: -48,
      },
      text: {
        color: Kb.Styles.globalColors.whiteOrWhite,
      },
    }) as const
)

export default Upload
