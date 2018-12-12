// @flow
import * as I from 'immutable'
import * as Types from '../../../../constants/types/chat2'
import {PlainInput} from '../../../../common-adapters'

// There are three components in this directory:
//
//   Input, with props InputProps, which wraps
//     MentionInput, with props MentionInputProps, which wraps
//       PlatformInput, with props PlatformInputProps.

type CommonProps = {|
  conversationIDKey: Types.ConversationIDKey,
  isEditExploded: boolean,
  isEditing: boolean,
  isExploding: boolean,
  isExplodingNew: boolean,
  explodingModeSeconds: number,
  focusInputCounter: number,
  clearInboxFilter: () => void,
  onAttach: (paths: Array<string>) => void,
  onEditLastMessage: () => void,
  onCancelEditing: () => void,
  onFilePickerError: (error: Error) => void,
  onSeenExplodingMessages: () => void,
  onSubmit: (text: string) => void,
  showWalletsIcon: boolean, // used on mobile to determine placeholder

  typing: I.Set<string>,
  editText: string,
  quoteCounter: number,
  quoteText: string,

  getUnsentText: () => string,
  setUnsentText: (text: string) => void,
  sendTyping: (text: string) => void,
|}

type InputProps = {|
  ...CommonProps,
  suggestUsers: I.List<{username: string, fullName: string}>,
  suggestChannels: Array<string>,
|}

type PlatformInputProps = {|
  ...CommonProps,
  inputSetRef: (r: null | PlainInput) => void,
  onChangeText: (newText: string) => void,
  onKeyDown: (evt: SyntheticKeyboardEvent<>) => void,
  setHeight: (inputHeight: number) => void, // used on mobile to position suggestion HUD
|}

export type {InputProps, PlatformInputProps}
