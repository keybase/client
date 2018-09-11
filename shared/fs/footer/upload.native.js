// @flow
import * as React from 'react'
import {globalStyles, globalColors, platformStyles} from '../../styles'
import {Button, Text, Box} from '../../common-adapters'
import {type UploadProps} from './upload'
import {NativeAnimated, NativeEasing} from '../../common-adapters/native-wrappers.native'

const patternRequire = require('../../images/upload-pattern-2-600.png')

type UploadState = {
  backgroundTop: NativeAnimated.AnimatedValue,
  uploadTop: NativeAnimated.AnimatedValue,
  showing: boolean,
}

const easing = NativeEasing.bezier(0.13, 0.72, 0.31, 0.95)

class Upload extends React.PureComponent<UploadProps, UploadState> {
  state = {
    backgroundTop: new NativeAnimated.Value(0),
    uploadTop: new NativeAnimated.Value(48),
    showing: false,
  }

  _mounted = false

  _animations = {
    loop: null,
    in: null,
    out: null,
  }

  _startAnimationLoop() {
    this._animations.loop = NativeAnimated.loop(
      NativeAnimated.timing(this.state.backgroundTop, {
        toValue: -80, // pattern loops on multiples of 80
        duration: 2000,
        easing: NativeEasing.linear,
      })
    )
    this._animations.loop.start()
  }
  _startAnimationIn() {
    this._animations.in = NativeAnimated.timing(this.state.uploadTop, {
      toValue: 0,
      duration: 300,
      easing,
    })
    this._animations.in.start()
  }
  _startAnimationOut(cbIfFinish: () => void) {
    this._animations.out = NativeAnimated.timing(this.state.uploadTop, {
      toValue: 48,
      duration: 300,
      easing,
    })
    this._animations.out.start(({finished}) => finished && cbIfFinish())
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
      <React.Fragment>
        {!!debugToggleShow && <Button type="Primary" onClick={debugToggleShow} label="Toggle" />}
        {this.state.showing && (
          <NativeAnimated.View style={{position: 'relative', top: this.state.uploadTop}}>
            <Box style={stylesBackgroundBox}>
              <NativeAnimated.Image
                source={patternRequire}
                style={{...stylesBackgroundImage, marginTop: this.state.backgroundTop}}
              />
            </Box>
            <Box style={stylesBox}>
              <Text key="files" type="BodySmallSemibold" style={stylesText}>
                {files
                  ? `Encrypting and uploading ${files} files...`
                  : totalSyncingBytes
                    ? 'Encrypting and uploading...'
                    : 'Done!'}
              </Text>
              {!!(timeLeft && timeLeft.length) && (
                <Text key="left" type="BodyTiny" style={stylesText}>{`${timeLeft} left`}</Text>
              )}
            </Box>
          </NativeAnimated.View>
        )}
      </React.Fragment>
    )
  }
}

const stylesBackgroundBox = platformStyles({
  common: {
    height: 48,
    width: '100%',
  },
  isIOS: {
    overflow: 'hidden',
  },
  isAndroid: {
    zIndex: -100, // Android doesn't support `overflow: 'hidden'`.
  },
})

const stylesBackgroundImage = {
  width: 600, // Android doesn't support resizeMode="repeat", so use a super wide image here.
  height: 160,
}

const stylesText = {
  color: globalColors.white,
}

const stylesBox = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  height: 48,
  marginTop: -48,
}

export default Upload
