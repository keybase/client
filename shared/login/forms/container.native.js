// @flow
import React from 'react'
import type {Props} from './container'
import {Box, HeaderHoc} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'

const Container = ({children, onBack, style, outerStyle}: Props) => {
  return (
    <Box style={{...styles.container, ...outerStyle}}>
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
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
  },
  innerContainer: {
    ...globalStyles.flexBoxColumn,
    marginTop: globalMargins.medium,
    flexGrow: 1,
  },
  button: {
    paddingTop: globalMargins.medium,
    paddingLeft: globalMargins.medium,
  },
}

export default HeaderHoc(Container)
