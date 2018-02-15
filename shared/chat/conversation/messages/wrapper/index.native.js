// @flow
import * as React from 'react'
import Wrapper from './shared'
import {
  NativeTouchableWithoutFeedback,
  NativeTouchableHighlight,
  Box,
  NativeKeyboard,
} from '../../../../common-adapters/index.native'
import {globalColors} from '../../../../styles'

import type {Props} from '.'

const dismissKeyboard = () => {
  NativeKeyboard.dismiss()
}

const NativeWrapper = (props: Props) => (
  <NativeTouchableHighlight
    onLongPress={props.onShowMenu}
    underlayColor={globalColors.white}
    onPress={dismissKeyboard}
  >
    <React.Fragment>
      <Wrapper {...props} />
    </React.Fragment>
  </NativeTouchableHighlight>
)

export default NativeWrapper
