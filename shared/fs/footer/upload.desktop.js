// @flow
import * as React from 'react'
import {globalStyles, globalColors} from '../../styles'
import {Box, Text} from '../../common-adapters'
import {resolveImageAsURL} from '../../desktop/app/resolve-root.desktop'
import {type UploadProps} from './upload'

const patternURL = resolveImageAsURL('upload-pattern-80.png')

const realCSS = `
@keyframes slideUp {
  from { background-position-y: 0; }
  to {background-position-y: 100%; }
}
.uploadBoxAnimation {
  animation: slideUp 2s linear infinite normal;
  background-image: url('${patternURL}')
}
`

const Upload = ({files, timeLeft}: UploadProps) => (
  <Box style={stylesBox} className="uploadBoxAnimation">
    <style>{realCSS}</style>
    <Text
      key="files"
      type="BodySemibold"
      style={stylesText}
    >{`Encrypting and uploading ${files} files...`}</Text>
    {!!(timeLeft && timeLeft.length) && (
      <Text key="left" type="BodySmall" style={stylesText}>{`${timeLeft} left`}</Text>
    )}
  </Box>
)

const stylesText = {
  color: globalColors.white,
}

const stylesBox = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  height: 40,
}

export default Upload
