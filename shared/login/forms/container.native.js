// @flow
import React from 'react'
import type {Props} from './container'
import {Box, HeaderHoc} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'
import {NativeScrollView} from '../../common-adapters/index.native'

const Container = ({children, onBack, style, outerStyle}: Props) => {
  return (
    <NativeScrollView style={{...styles.container, ...outerStyle}}>
      <Box style={{...styles.innerContainer, ...style}}>
        {children}
      </Box>
    </NativeScrollView>
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
