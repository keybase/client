import * as I from 'immutable'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Types from '../../../../constants/types/chat2'
import {PlainInput} from '../../../../common-adapters'

type CommonProps = {
  cannotWrite: boolean | null
  conversationIDKey: Types.ConversationIDKey
  isEditExploded: boolean
  isEditing: boolean
  isExploding: boolean
  isSearching: boolean
  explodingModeSeconds: number
  focusInputCounter: number
  clearInboxFilter: () => void
  minWriterRole: string
  onAttach: (paths: Array<string>) => void
  onEditLastMessage: () => void
  onCancelEditing: () => void
  onCancelReply: () => void
  onFilePickerError: (error: Error) => void
  onRequestScrollDown: () => void
  onRequestScrollUp: () => void
  onSubmit: (text: string) => void
  showCommandMarkdown: boolean
  showCommandStatus: boolean
  showGiphySearch: boolean
  showReplyPreview: boolean
  showTypingStatus: boolean
  showWalletsIcon: boolean
  editText: string
  quoteCounter: number
  quoteText: string
  getUnsentText: () => string
  setUnsentText: (text: string) => void
  sendTyping: (typing: boolean) => void
  unsentTextChanged: (text: string) => void
  unsentText: string | null
  prependText: string | null
}

export type InputProps = {
  isActiveForFocus: boolean
  suggestTeams: Array<{
    username: string
    fullName: string
    teamname: string
  }>
  suggestUsers: I.List<{
    username: string
    fullName: string
    teamname?: string
  }>
  suggestChannels: I.List<string>
  suggestAllChannels: I.List<{
    teamname: string
    channelname: string
  }>
  suggestCommands: Array<RPCChatTypes.ConversationCommand>
  suggestBotCommands: Array<RPCChatTypes.ConversationCommand>
  suggestBotCommandsUpdateStatus: RPCChatTypes.UIBotCommandsUpdateStatus
} & CommonProps

export type PlatformInputProps = {
  inputSetRef: (r: null | PlainInput) => void
  onChangeText: (newText: string) => void
  onKeyDown: (evt: React.KeyboardEvent, isComposingIME: boolean) => void
  setHeight: (inputHeight: number) => void
  suggestBotCommandsUpdateStatus: RPCChatTypes.UIBotCommandsUpdateStatus
} & CommonProps
