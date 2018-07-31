// @flow
import * as React from 'react'
import {
  FloatingMenuParentHOC,
  type FloatingMenuParentProps,
} from '../../../../../common-adapters/floating-menu'
import {NativeTouchableHighlight} from '../../../../../common-adapters/mobile.native'
import {globalColors} from '../../../../../styles'
import WrapperTimestamp from '.'
import type {WrapperTimestampProps} from '../index.types'

const _MenuWrapper = (props: WrapperTimestampProps & FloatingMenuParentProps) => (
  <NativeTouchableHighlight onLongPress={props.toggleShowingMenu} underlayColor={globalColors.white}>
    <WrapperTimestamp {...props} />
  </NativeTouchableHighlight>
)
const MenuWrapper = FloatingMenuParentHOC(_MenuWrapper)

export default MenuWrapper
