// @flow
import React from 'react'
import type {Props} from './container'
import {Box, HeaderHoc} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'
import {NativeScrollView} from '../../common-adapters/index.native'

const Container = ({children, style, outerStyle}: Props) => {
  return (
    <NativeScrollView style={{...containerStyle, ...outerStyle}}>
      <Box style={{...innerContainerStyle, ...style}}>
        {children}
      </Box>
    </NativeScrollView>
  )
}

const innerContainerStyle = {
  ...globalStyles.flexBoxColumn,
  marginTop: globalMargins.medium,
  flexGrow: 1,
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  flexGrow: 1,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

export default HeaderHoc(Container)
