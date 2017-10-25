// @flow
import * as React from 'react'
import * as I from 'immutable'
import Box from './box'
import PopupDialog from './popup-dialog'
import {isMobile} from '../constants/platform'
import {globalColors} from '../styles'

const MaybePopup = isMobile
  ? (props: {onClose: () => void, children: React.Node}) => (
      <Box style={{height: '100%', width: '100%'}} children={props.children} />
    )
  : (props: {onClose: () => void, children: React.Node}) => (
      <PopupDialog
        onClose={props.onClose}
        styleCover={_styleCover}
        styleContainer={_styleContainer}
        children={props.children}
      />
    )

function MaybePopupHoc<P: {}>(WrappedComponent: React.ComponentType<P>) {
  return (
    props: P & {navigateUp: Function, routeProps: I.RecordOf<{onClose: (navigateUpFn: Function) => void}>}
  ) => {
    const onClose = () => {
      props.routeProps && props.routeProps.get('onClose') && props.routeProps.get('onClose')(props.navigateUp)
    }
    return (
      <MaybePopup onClose={onClose}>
        <WrappedComponent onClose={onClose} {...(props: P)} />
      </MaybePopup>
    )
  }
}

const _styleCover = {
  alignItems: 'stretch',
  backgroundColor: globalColors.black_75,
  justifyContent: 'stretch',
}

const _styleContainer = {
  height: '100%',
}

export {initAvatarLookup, initAvatarLoad} from './index.shared'
export {default as AutosizeInput} from './autosize-input'
export {default as Avatar} from './avatar'
export {default as BackButton} from './back-button'
export {default as Badge} from './badge'
export {default as Banner} from './banner'
export {default as Box} from './box'
export {default as Button} from './button'
export {default as Checkbox} from './checkbox'
export {default as ChoiceList} from './choice-list'
export {default as ClickableBox} from './clickable-box'
export {default as ComingSoon} from './coming-soon'
export {default as Confirm} from './confirm'
export {default as CopyableText} from './copyable-text'
export {default as Divider} from './divider'
export {default as Dropdown} from './dropdown'
export {default as Emoji} from './emoji'
export {default as ErrorBoundary} from './error-boundary'
export {default as FollowButton} from './follow-button'
export {default as FormWithCheckbox} from './form-with-checkbox'
export {default as Header} from './header'
export {default as HeaderHoc} from './header-hoc'
export {default as HOCTimers} from './hoc-timers'
export {default as Icon} from './icon'
export {default as Input} from './input'
export {default as List} from './list'
export {default as LoadingLine} from './loading-line'
export {default as LinkWithIcon} from './link-with-icon'
export {default as ListItem} from './list-item'
export {default as Markdown} from './markdown'
export {MaybePopup, MaybePopupHoc}
export {default as MultiAvatar} from './multi-avatar.js'
export {default as Meta} from './meta'
export {default as PlatformIcon} from './platform-icon'
export {default as PopupDialog} from './popup-dialog'
export {default as PopupMenu} from './popup-menu'
export {default as ProgressIndicator} from './progress-indicator'
export {default as RadioButton} from './radio-button'
export {default as ScrollView} from './scroll-view'
export {default as StandardScreen} from './standard-screen'
export {default as TabBar} from './tab-bar'
export {default as Tabs} from './tabs'
export {default as Text} from './text'
export {default as UserActions} from './user-actions'
export {default as UserBio} from './user-bio'
export {default as UserCard} from './user-card'
export {default as UserProofs} from './user-proofs'
export {PlaintextUsernames, Usernames} from './usernames'
