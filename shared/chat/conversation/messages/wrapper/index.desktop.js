// @flow
import * as React from 'react'
import Wrapper from './shared'
import {withHandlers} from '../../../../util/container'
import {FloatingMenuParentHOC} from '../../../../common-adapters/floating-menu'
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

const WrapperWithFloatingMenu = FloatingMenuParentHOC(Wrapper)

export default withHandlers({
  onShowMenu: props => event => {
    const node = event.target instanceof window.HTMLElement ? event.target : null
    props.onShowMenu(node ? node.getBoundingClientRect() : null)
  },
})(WrapperWithFloatingMenu)
