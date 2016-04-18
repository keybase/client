// @flow
import React from 'react-native'
import {globalStyles} from '../../styles/style-guide'
import {Box, BackButton} from '../../common-adapters'
import type {Props} from './container'

export default ({children, onBack, style, outerStyle}: Props) => {
  return (
    <Box style={{...styles.container, ...outerStyle}}>
      <Box style={{...styles.innerContainer, ...style}}>
        {children}
      </Box>
      {onBack && <BackButton style={styles.button} onClick={onBack}/>}
    </Box>
  )
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    bottom: 0,
    left: 0,
    padding: 16,
    position: 'absolute',
    flex: 1,
    right: 0,
    top: 6
  },
  innerContainer: {
    ...globalStyles.flexBoxColumn,
    flex: 1
  },
  button: {
    position: 'absolute',
    top: 13,
    left: 16
  }
}
