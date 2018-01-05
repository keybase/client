// @flow
import * as React from 'react'
import Wrapper from './shared'
import {NativeTouchableHighlight, Box, NativeKeyboard} from '../../../../common-adapters/index.native'
import {globalColors} from '../../../../styles'

import type {Props} from '.'

const dismissKeyboard = () => {
  NativeKeyboard.dismiss()
}

const NativeWrapper = (props: Props) => (
  <NativeTouchableHighlight
    onLongPress={props.onShowMenu}
    underlayColor={globalColors.black_10}
    onPress={dismissKeyboard}
  >
    <Box>
      {/* $FlowIssue */}
      <Wrapper {...props} />
    </Box>
  </NativeTouchableHighlight>
)

export default NativeWrapper
