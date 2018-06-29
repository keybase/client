// @flow
import * as React from 'react'
import WrapperTimestamp from './wrapper-timestamp'
import WrapperAuthor from './wrapper-author'
import {NativeTouchableHighlight, NativeKeyboard} from '../../../../common-adapters/mobile.native'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../../../common-adapters/floating-menu'
import {globalColors} from '../../../../styles'
import type {WrapperAuthorProps} from './index.types'

const dismissKeyboard = () => {
  NativeKeyboard.dismiss()
}

const _NativeWrapper = (props: WrapperAuthorProps & FloatingMenuParentProps) => (
  <NativeTouchableHighlight
    onLongPress={props.exploded ? undefined : props.toggleShowingMenu}
    underlayColor={globalColors.white}
    onPress={dismissKeyboard}
  >
    <React.Fragment>
      <WrapperAuthor {...props} />
    </React.Fragment>
  </NativeTouchableHighlight>
)
const NativeWrapper = FloatingMenuParentHOC(_NativeWrapper)

export {NativeWrapper as WrapperAuthor, WrapperTimestamp}

export default NativeWrapper
