// @flow
import React from 'react-native'
import {globalStyles} from '../../styles/style-guide'
import {Box, BackButton} from '../../common-adapters'
import type {Props} from './container'

export default ({children, onBack, style, outerStyle}: Props) => {
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
    bottom: 0,
    left: 0,
    padding: 60,
    position: 'absolute',
    flex: 1,
    right: 0,
    top: 0
  },
  innerContainer: {
    ...globalStyles.flexBoxColumn,
    flex: 1
  },
  button: {
    position: 'absolute'
  }
}
