// @flow
import * as React from 'react'
import Wrapper from './shared'
import {NativeTouchableHighlight, NativeKeyboard} from '../../../../common-adapters/native'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../../../common-adapters/floating-menu'
import {globalColors} from '../../../../styles'
import * as Types from '../../../../constants/types/chat2'

export type Props = {
  author: string,
  failureDescription: string,
  includeHeader: boolean,
  innerClass: React.ComponentType<any>,
  isBroken: boolean,
  isEdited: boolean,
  isEditing: boolean,
  isFollowing: boolean,
  isRevoked: boolean,
  isYou: boolean,
  message: Types.MessageText | Types.MessageAttachment,
  messageFailed: boolean,
  messageSent: boolean,
  onRetry: null | (() => void),
  onEdit: null | (() => void),
  onCancel: null | (() => void),
  onAuthorClick: () => void,
  orangeLineAbove: boolean,
  timestamp: string,
}

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
