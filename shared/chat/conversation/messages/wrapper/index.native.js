// @flow
import * as React from 'react'
import {MessageWrapper, MessageWrapperUserContent} from './shared'
import {NativeTouchableHighlight, NativeKeyboard} from '../../../../common-adapters/mobile.native'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../../../common-adapters/floating-menu'
import {globalColors} from '../../../../styles'
import type {WrapperUserContentProps} from './index.types'

const dismissKeyboard = () => {
  NativeKeyboard.dismiss()
}

const _NativeWrapper = (props: WrapperUserContentProps & FloatingMenuParentProps) => (
  <NativeTouchableHighlight
    onLongPress={props.exploded ? undefined : props.toggleShowingMenu}
    underlayColor={globalColors.white}
    onPress={dismissKeyboard}
  >
    <React.Fragment>
      <MessageWrapperUserContent {...props} />
    </React.Fragment>
  </NativeTouchableHighlight>
)
const NativeWrapper = FloatingMenuParentHOC(_NativeWrapper)

export {NativeWrapper as WrapperUserContent, MessageWrapper as Wrapper}

export default NativeWrapper
