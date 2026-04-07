import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {UploadProps} from './upload'
import {Animated as NativeAnimated, Easing as NativeEasing} from 'react-native'
import {useColorScheme} from 'react-native'

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

  React.useEffect(() => {
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
      setShowing(true)
      startAnimationIn()
      startAnimationLoop()
    }
    const exit = () => {
      stopAnimation('in')
      startAnimationOut(() => {
        stopAnimation('loop')
        if (mountedRef.current) setShowing(false)
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

  const isDarkMode = useColorScheme() === 'dark'
  return (
    <>
      {!!debugToggleShow && <Kb.Button onClick={debugToggleShow} label="Toggle" />}
      {showing && (
        <NativeAnimated.View style={{position: 'relative', top: uploadTop}}>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.backgroundBox}>
            <NativeAnimated.Image
              resizeMode="repeat"
              source={isDarkMode ? darkPatternImage : lightPatternImage}
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
      text: {
        color: Kb.Styles.globalColors.whiteOrWhite,
      },
    }) as const
)

export default Upload
