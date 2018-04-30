// @flow
import * as React from 'react'
import Wrapper from './shared'
import {NativeTouchableHighlight, NativeKeyboard} from '../../../../common-adapters/index.native'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../../../common-adapters/floating-menu'
import {globalColors} from '../../../../styles'

import type {Props} from '.'

const dismissKeyboard = () => {
  NativeKeyboard.dismiss()
}

const _NativeWrapper = (props: Props & FloatingMenuParentProps) => (
  <NativeTouchableHighlight
    onLongPress={props.toggleShowingMenu}
    underlayColor={globalColors.white}
    onPress={dismissKeyboard}
  >
    <React.Fragment>
      <Wrapper {...props} />
    </React.Fragment>
  </NativeTouchableHighlight>
)
const NativeWrapper = FloatingMenuParentHOC(_NativeWrapper)

export default NativeWrapper
