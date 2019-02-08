// @flow
import * as I from 'immutable'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Types from '../../../../constants/types/chat2'
import {PlainInput} from '../../../../common-adapters'

// There are two components in this directory:
//
//   Input, with props InputProps, which wraps
//     PlatformInput, with props PlatformInputProps.

type CommonProps = {|
  conversationIDKey: Types.ConversationIDKey,
  isEditExploded: boolean,
  isEditing: boolean,
  isExploding: boolean,
  explodingModeSeconds: number,
  focusInputCounter: number,
  clearInboxFilter: () => void,
  onAttach: (paths: Array<string>) => void,
  onEditLastMessage: () => void,
  onCancelEditing: () => void,
  onFilePickerError: (error: Error) => void,
  onRequestScrollDown: () => void,
  onRequestScrollUp: () => void,
  onSubmit: (text: string) => void,
  showWalletsIcon: boolean, // used on mobile to determine placeholder

  editText: string,
  quoteCounter: number,
  quoteText: string,

  getUnsentText: () => string,
  setUnsentText: (text: string) => void,
  sendTyping: (text: string) => void,

  unsentTextRefresh: boolean,
|}

type InputProps = {|
  ...CommonProps,
  isActiveForFocus: boolean,
  suggestUsers: I.List<{username: string, fullName: string}>,
  suggestChannels: I.List<string>,
  suggestCommands: Array<RPCChatTypes.ConversationCommand>,
|}

type PlatformInputProps = {|
  ...CommonProps,
  inputSetRef: (r: null | PlainInput) => void,
  onChangeText: (newText: string) => void,
  onKeyDown: (evt: SyntheticKeyboardEvent<>, isComposingIME: boolean) => void,
  setHeight: (inputHeight: number) => void, // used on mobile to position suggestion HUD
|}

export type {InputProps, PlatformInputProps}
