// @flow
import * as React from 'react'
import {globalStyles, globalColors, backgroundURL} from '../../styles'
import {Button, Box, Text} from '../../common-adapters'
import {CSSTransition} from 'react-transition-group'
import {type UploadProps} from './upload'

const patternImage = 'upload-pattern-2-600.png'

const height = 40

const easing = 'cubic-bezier(.13,.72,.31,.95)'

const realCSS = `
@keyframes slideUp {
  from { background-position-y: 0; }
  to {background-position-y: 100%; }
}
.upload-animation-loop {
  animation: slideUp 4s linear infinite normal;
  background-repeat: repeat-x;
  background-image: ${backgroundURL(patternImage)};
}
.upload-animation-enter {
  top: ${height}px;
}
.upload-animation-enter-active {
  top: 0;
  transition: all .3s ${easing};
}
.upload-animation-exit {
  top: 0;
}
.upload-animation-exit-active {
  top: ${height}px;
  transition: all .3s ${easing};
}
.text-overflow {
  color: ${globalColors.white};
  max-width: 60vw;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}
`

const Upload = ({showing, files, fileName, totalSyncingBytes, timeLeft, debugToggleShow}: UploadProps) => {
  return (
    <React.Fragment>
      {!!debugToggleShow && <Button type="Primary" onClick={debugToggleShow} label="Toggle" />}
      <CSSTransition in={showing} classNames="upload-animation" timeout={300} unmountOnExit={true}>
        <Box className="upload-animation-loop" style={stylesBox}>
          <style>{realCSS}</style>
          <Text key="files" type="BodySemibold" className="text-overflow">
            {files
              ? fileName
                ? `Encrypting and uploading ${fileName}...`
                : `Encrypting and uploading ${files} files...`
              : totalSyncingBytes
                ? 'Encrypting and uploading...'
                : 'Done!'}
          </Text>
          {!!(timeLeft && timeLeft.length) && (
            <Text key="left" type="BodySmall" style={stylesText}>{`${timeLeft} left`}</Text>
          )}
        </Box>
      </CSSTransition>
    </React.Fragment>
  )
}

const stylesText = {
  color: globalColors.white,
}

const stylesBox = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  alignItems: 'center',
  justifyContent: 'center',
  maxHeight: height,
}

export default Upload
