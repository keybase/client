// @flow
import * as React from 'react'
import {globalStyles, globalColors} from '../../styles'
import {Text, Box} from '../../common-adapters'
import {type UploadProps} from './upload'
import {NativeAnimated, NativeEasing} from '../../common-adapters/native-wrappers.native'

const patternRequire = require('../../images/upload-pattern-80.png')

type UploadState = {
  backgroundTop: NativeAnimated.AnimatedValue,
}

class Upload extends React.PureComponent<UploadProps, UploadState> {
  state = {
    backgroundTop: new NativeAnimated.Value(0),
  }

  componentDidMount() {
    NativeAnimated.loop(
      NativeAnimated.timing(this.state.backgroundTop, {
        toValue: -40,
        duration: 2000,
        easing: NativeEasing.linear,
      })
    ).start()
  }

  render() {
    const {files, timeLeft} = this.props
    return (
      <Box>
        <Box style={stylesBackgroundBox}>
          <NativeAnimated.Image
            source={patternRequire}
            resizeMode="repeat"
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
      </Box>
    )
  }
}

const stylesBackgroundBox = {
  height: 48,
  width: '100%',
  overflow: 'hidden',
}

const stylesBackgroundImage = {
  width: '100%',
  height: 96,
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
