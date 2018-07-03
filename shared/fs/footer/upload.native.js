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
  mounted: boolean,
}

const easing = NativeEasing.bezier(0.13, 0.72, 0.31, 0.95)

class Upload extends React.PureComponent<UploadProps, UploadState> {
  state = {
    backgroundTop: new NativeAnimated.Value(0),
    uploadTop: new NativeAnimated.Value(48),
    mounted: false,
  }

  animations = {
    loop: null,
    in: null,
    out: null,
  }

  startAnimationLoop() {
    this.animations.loop = NativeAnimated.loop(
      NativeAnimated.timing(this.state.backgroundTop, {
        toValue: -80, // pattern loops on multiples of 80
        duration: 2000,
        easing: NativeEasing.linear,
      })
    )
    this.animations.loop.start()
  }
  startAnimationIn() {
    this.animations.in = NativeAnimated.timing(this.state.uploadTop, {
      toValue: 0,
      duration: 300,
      easing,
    })
    this.animations.in.start()
  }
  startAnimationOut(cbIfFinish: () => void) {
    this.animations.out = NativeAnimated.timing(this.state.uploadTop, {
      toValue: 48,
      duration: 300,
      easing,
    })
    this.animations.out.start(({finished}) => finished && cbIfFinish())
  }
  stopAnimation(animation: string) {
    if (!this.animations[animation]) {
      return
    }
    this.animations[animation].stop()
    this.animations[animation] = null
  }

  enter() {
    this.setState({mounted: true})
    this.stopAnimation('out')
    this.startAnimationIn()
    this.startAnimationLoop()
  }

  exit() {
    this.stopAnimation('in')
    this.startAnimationOut(() => {
      this.stopAnimation('loop')
      this.setState({mounted: false})
    })
  }

  componentDidUpdate(prevProps: UploadProps) {
    if (!prevProps.files && this.props.files) {
      this.enter()
      return
    }

    if (prevProps.files && !this.props.files) {
      this.exit()
    }
  }

  componentWillUnmount() {
    this.stopAnimation('in')
    this.stopAnimation('out')
    this.stopAnimation('loop')
  }

  render() {
    const {files, timeLeft, debugToggleShow} = this.props
    return (
      <React.Fragment>
        {!!debugToggleShow && <Button type="Primary" onClick={debugToggleShow} label="Toggle" />}
        {this.state.mounted && (
          <NativeAnimated.View style={{position: 'relative', top: this.state.uploadTop}}>
            <Box style={stylesBackgroundBox}>
              <NativeAnimated.Image
                source={patternRequire}
                style={{...stylesBackgroundImage, marginTop: this.state.backgroundTop}}
              />
            </Box>
            <Box style={stylesBox}>
              <Text
                key="files"
                type="BodySmallSemibold"
                style={stylesText}
              >{`Encrypting and uploading ${files} files...`}</Text>
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
