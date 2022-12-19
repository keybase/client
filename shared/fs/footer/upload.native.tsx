import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import type {UploadProps} from './upload'
import {NativeAnimated, NativeEasing} from '../../common-adapters/native-wrappers.native'

const lightPatternImage = require('../../images/upload-pattern-80.png')
const darkPatternImage = require('../../images/dark-upload-pattern-80.png')

type UploadState = {
  backgroundTop: NativeAnimated.AnimatedValue
  uploadTop: NativeAnimated.AnimatedValue
  showing: boolean
}

const easing = NativeEasing.bezier(0.13, 0.72, 0.31, 0.95)

class Upload extends React.PureComponent<UploadProps, UploadState> {
  state = {
    backgroundTop: new NativeAnimated.Value(0),
    showing: false,
    uploadTop: new NativeAnimated.Value(48),
  }

  _mounted = false

  _animations: {
    in: NativeAnimated.CompositeAnimation | null
    loop: NativeAnimated.CompositeAnimation | null
    out: NativeAnimated.CompositeAnimation | null
  } = {
    in: null,
    loop: null,
    out: null,
  }

  _startAnimationLoop() {
    const loop = NativeAnimated.loop(
      NativeAnimated.timing(this.state.backgroundTop, {
        duration: 2000,
        easing: NativeEasing.linear,
        toValue: -80, // pattern loops on multiples of 80
        useNativeDriver: false,
      })
    )
    loop.start()
  }
  _startAnimationIn() {
    const ain = NativeAnimated.timing(this.state.uploadTop, {
      duration: 300,
      easing,
      toValue: 0,
      useNativeDriver: false,
    })
    this._animations.in = ain
    ain.start()
  }
  _startAnimationOut(cbIfFinish: () => void) {
    const out = NativeAnimated.timing(this.state.uploadTop, {
      duration: 300,
      easing,
      toValue: 48,
      useNativeDriver: false,
    })
    this._animations.out = out
    out.start(({finished}) => finished && cbIfFinish())
  }
  _stopAnimation(animation: string) {
    if (!this._animations[animation]) {
      return
    }
    this._animations[animation].stop()
    this._animations[animation] = null
  }
  _stopAllAnimations() {
    this._stopAnimation('out')
    this._stopAnimation('loop')
    this._stopAnimation('in')
  }

  _enter() {
    this._stopAllAnimations()
    this.setState({showing: true})
    this._startAnimationIn()
    this._startAnimationLoop()
  }

  _exit() {
    this._stopAnimation('in')
    this._startAnimationOut(() => {
      this._stopAnimation('loop')
      this._mounted && this.setState({showing: false})
    })
  }

  componentDidMount() {
    this._mounted = true
    if (this.props.showing) {
      // Need this to make sure we are showing the animation if upload started
      // before we are mounted. This could happen when we already have the bar
      // present, and user goes into next level folder which isn't mounted. So
      // that component will never get a componentDidUpdate where prevProps is
      // not showing but current is, thus never calls _enter(). So just call it
      // here to make sure we do show the bar.
      this._enter()
    }
  }

  componentDidUpdate(prevProps: UploadProps) {
    if (!prevProps.showing && this.props.showing) {
      this._enter()
      return
    }

    if (prevProps.showing && !this.props.showing) {
      this._exit()
    }
  }

  componentWillUnmount() {
    this._stopAllAnimations()
    this._mounted = false
  }

  render() {
    const {files, totalSyncingBytes, timeLeft, debugToggleShow} = this.props
    return (
      <>
        {!!debugToggleShow && <Kb.Button onClick={debugToggleShow} label="Toggle" />}
        {this.state.showing && (
          <NativeAnimated.View style={{position: 'relative', top: this.state.uploadTop}}>
            <Kb.Box style={styles.backgroundBox}>
              <NativeAnimated.Image
                resizeMode="repeat"
                source={Styles.isDarkMode() ? darkPatternImage : lightPatternImage}
                style={{...styles.backgroundImage, marginTop: this.state.backgroundTop}}
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
              {!!(timeLeft && timeLeft.length) && (
                <Kb.Text key="left" type="BodyTiny" style={styles.text}>{`${timeLeft} left`}</Kb.Text>
              )}
            </Kb.Box>
          </NativeAnimated.View>
        )}
      </>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      backgroundBox: Styles.platformStyles({
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
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        height: 48,
        justifyContent: 'center',
        marginTop: -48,
      },
      text: {
        color: Styles.globalColors.whiteOrWhite,
      },
    } as const)
)

export default Upload
