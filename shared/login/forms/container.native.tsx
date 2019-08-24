import * as React from 'react'
import {Props} from './container'
import {globalMargins, globalStyles} from '../../styles'
import {Box, NativeScrollView} from '../../common-adapters/mobile.native'

const Container = ({children, style, outerStyle}: Props) => {
  return (
    <NativeScrollView style={{...containerStyle, ...outerStyle}}>
      <Box style={{...innerContainerStyle, ...style}}>{children}</Box>
    </NativeScrollView>
  )
}

const innerContainerStyle = {
  ...globalStyles.flexBoxColumn,
  flexGrow: 1,
  marginTop: globalMargins.medium,
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  flexGrow: 1,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

export default Container
