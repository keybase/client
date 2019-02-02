// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import {Button, Box, Text} from '../../common-adapters'
import {CSSTransition} from 'react-transition-group'
import {type UploadProps} from './upload'

const patternImage = 'upload-pattern-2-80.png'

const height = 40

const easing = 'cubic-bezier(.13,.72,.31,.95)'

const realCSS = `
@keyframes slideUp {
  from { background-position-y: 0; }
  to {background-position-y: 200%; }
}
.upload-animation-loop {
  animation: slideUp 2s linear infinite normal;
  background-repeat: repeat;
  background-image: ${Styles.backgroundURL(patternImage)};
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
`

const Upload = ({showing, files, fileName, totalSyncingBytes, timeLeft, debugToggleShow}: UploadProps) => {
  return (
    <React.Fragment>
      {!!debugToggleShow && <Button type="Primary" onClick={debugToggleShow} label="Toggle" />}
      <CSSTransition in={showing} classNames="upload-animation" timeout={300} unmountOnExit={true}>
        <Box className="upload-animation-loop" style={styles.stylesBox}>
          <style>{realCSS}</style>
          <Text key="files" type="BodySemibold" style={styles.textOverflow}>
            {files
              ? fileName
                ? `Encrypting and uploading ${fileName}...`
                : `Encrypting and uploading ${files} files...`
              : totalSyncingBytes
              ? 'Encrypting and uploading...'
              : 'Done!'}
          </Text>
          {!!(timeLeft && timeLeft.length) && (
            <Text key="left" type="BodySmall" style={styles.stylesText}>{`${timeLeft} left`}</Text>
          )}
        </Box>
      </CSSTransition>
    </React.Fragment>
  )
}

const styles = Styles.styleSheetCreate({
  stylesBox: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flexShrink: 0, // need this to be whole in menubar
    height,
    justifyContent: 'center',
    maxHeight: height,
    position: 'relative',
  },
  stylesText: {
    color: Styles.globalColors.white,
  },
  textOverflow: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.white,
      maxWidth: '60%',
      overflow: 'hidden',
      textAlign: 'center',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
})

export default Upload
