// @flow
import React from 'react'
import type {Props} from './container'
import {Box, BackButton} from '../../common-adapters'
import {globalStyles} from '../../styles'

const Container = ({children, onBack, style, outerStyle}: Props) => {
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
    flexGrow: 1,
  },
  innerContainer: {
    ...globalStyles.flexBoxColumn,
    marginTop: 30,
    flexGrow: 1,
  },
  button: {
    position: 'absolute',
    top: 22,
    left: 22,
  },
}

export default Container
