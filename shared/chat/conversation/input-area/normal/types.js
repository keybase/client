// @flow
import * as I from 'immutable'
import * as Types from '../../../../constants/types/chat2'
import {Input as TextInput} from '../../../../common-adapters'

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
  typing: I.Set<string>,
|}

type InputProps = {|
  ...CommonProps,
  editText: string,
  quoteCounter: number,
  quoteText: string,

  getUnsentText: () => string,
  setUnsentText: (text: string) => void,
  sendTyping: (typing: boolean) => void,
|}

type MentionInputProps = {|
  ...InputProps,
  inputSetRef: (r: ?TextInput) => void,
  onChangeText: (newText: string) => void,
|}

type MentionProps = {|
  insertMention: (u: string, options?: {notUser: boolean}) => void,
  insertChannelMention: (c: string, options?: {notChannel: boolean}) => void,

  // on desktop:
  onKeyDown?: (e: SyntheticKeyboardEvent<>) => void,
  switchMention?: (u: string) => void,
  switchChannelMention?: (c: string) => void,
  upArrowCounter?: number,
  downArrowCounter?: number,
  // on mobile:
  onBlur?: () => void,
  onFocus?: () => void,
  insertMentionMarker?: () => void,

  pickSelectedCounter: number,
  channelMentionFilter: string,
  channelMentionPopupOpen: boolean,
  setChannelMentionPopupOpen: (setOpen: boolean) => void,
  mentionFilter: string,
  mentionPopupOpen: boolean,
  setMentionPopupOpen: (setOpen: boolean) => void,
|}

type PlatformInputProps = {...MentionInputProps, ...MentionProps}

export type {InputProps, MentionInputProps, PlatformInputProps}
