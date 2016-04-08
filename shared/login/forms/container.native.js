// @flow
import React from 'react-native'
import {globalStyles} from '../../styles/style-guide'
import {Box, BackButton} from '../../common-adapters'
import type {Props} from './container'

export default ({children, onBack, style, outerStyle}: Props) => {
  console.log('in container.native.js')
  return (
    <Box style={{...styles.container, ...outerStyle}}>
      {onBack && <BackButton style={styles.button} onClick={onBack}/>}
      <Box style={{...styles.innerContainer, ...style}}>
        {children}
      </Box>
    </Box>
  )
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    bottom: 0,
    justifyContent: 'flex-start',
    left: 0,
    padding: 60,
    position: 'absolute',
    right: 0,
    top: 0
  },
  innerContainer: {
    ...globalStyles.flexBoxColumn,
    alignSelf: 'stretch'
  },
  button: {
    position: 'absolute'
  }
}
