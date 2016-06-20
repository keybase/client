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
      {onBack && <BackButton style={styles.button} onClick={onBack} />}
    </Box>
  )
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    padding: 16,
    flex: 1,
  },
  innerContainer: {
    ...globalStyles.flexBoxColumn,
    marginTop: 30,
    flex: 1,
  },
  button: {
    position: 'absolute',
    top: 22,
    left: 22,
  },
}
