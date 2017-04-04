// @flow
import React from 'react'
import type {Props} from './container'
import {Box, BackButton} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'

const Container = ({children, onBack, style, outerStyle}: Props) => {
  return (
    <Box style={{...styles.container, ...outerStyle}}>
      {onBack && <BackButton style={styles.button} onClick={onBack} />}
      <Box style={{...styles.innerContainer, ...style}}>
        {children}
      </Box>
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
    marginTop: globalMargins.tiny,
    flexGrow: 1,
  },
  button: {
    paddingTop: 22,
    paddingLeft: 22,
  },
}

export default Container
