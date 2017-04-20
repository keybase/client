// @flow
import React from 'react'
import Wrapper from './shared'
import {NativeTouchableHighlight, Box} from '../../../../common-adapters/index.native'
import {globalColors} from '../../../../styles'

import type {Props} from '.'

const NativeWrapper = (props: Props) => (
  <NativeTouchableHighlight onLongPress={props.onAction} underlayColor={globalColors.black_10}>
    <Box>
      <Wrapper {...props} />
    </Box>
  </NativeTouchableHighlight>
)

export default NativeWrapper
