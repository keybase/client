// @flow
import React from 'react'
import Wrapper from './shared'
import {NativeTouchableHighlight, Box, NativeKeyboard} from '../../../../common-adapters/index.native'
import {globalColors} from '../../../../styles'

import type {Props} from '.'

const dismissKeyboard = () => {
  NativeKeyboard.dismiss()
}

const NativeWrapper = (props: Props) =>
  <NativeTouchableHighlight
    onLongPress={props.onAction}
    underlayColor={globalColors.black_10}
    onPress={dismissKeyboard}
  >
    <Box>
      <Wrapper {...props} />
    </Box>
  </NativeTouchableHighlight>

export default NativeWrapper
