// @flow
import * as React from 'react'
import WrapperTimestamp from './wrapper-timestamp'
import WrapperAuthor from './wrapper-author'
import {NativeTouchableHighlight, NativeKeyboard} from '../../../../common-adapters/mobile.native'
import {OverlayParentHOC, type OverlayParentProps} from '../../../../common-adapters'
import {globalColors} from '../../../../styles'
import type {WrapperAuthorProps} from './index.types'

const dismissKeyboard = () => {
  NativeKeyboard.dismiss()
}

const _NativeWrapper = (props: WrapperAuthorProps & OverlayParentProps) => (
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
const NativeWrapper = OverlayParentHOC(_NativeWrapper)

export {NativeWrapper as WrapperAuthor, WrapperTimestamp}

export default NativeWrapper
