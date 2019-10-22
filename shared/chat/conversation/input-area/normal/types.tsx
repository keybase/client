import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Types from '../../../../constants/types/chat2'
import * as TeamTypes from '../../../../constants/types/teams'
import {PlainInput} from '../../../../common-adapters'

type CommonProps = {
  audio?: Types.AudioRecordingInfo
  cannotWrite: boolean | null
  clearInboxFilter: () => void
  conversationIDKey: Types.ConversationIDKey
  editText: string
  explodingModeSeconds: number
  focusInputCounter: number
  getUnsentText: () => string
  isEditExploded: boolean
  isEditing: boolean
  isExploding: boolean
  isLockedAudio: boolean
  isSearching: boolean
  minWriterRole: TeamTypes.TeamRoleType
  onAttach: (paths: Array<string>) => void
  onCancelEditing: () => void
  onCancelReply: () => void
  onEditLastMessage: () => void
  onFilePickerError: (error: Error) => void
  onGiphyToggle: () => void
  onLockAudioRecording: () => void
  onRequestScrollDown: () => void
  onRequestScrollUp: () => void
  onStartAudioRecording: () => void
  onStopAudioRecording: (stopType: Types.AudioStopType) => void
  onSubmit: (text: string) => void
  prependText: string | null
  quoteCounter: number
  quoteText: string
  sendTyping: (typing: boolean) => void
  setUnsentText: (text: string) => void
  showCommandMarkdown: boolean
  showCommandStatus: boolean
  showGiphySearch: boolean
  showReplyPreview: boolean
  showTypingStatus: boolean
  showWalletsIcon: boolean
  unsentText: string | null
  unsentTextChanged: (text: string) => void
}

export type InputProps = {
  isActiveForFocus: boolean
  suggestTeams: Array<{
    username: string
    fullName: string
    teamname: string
  }>
  suggestUsers: Array<{
    username: string
    fullName: string
    teamname?: string
  }>
  suggestChannels: Array<string>
  suggestAllChannels: Array<{
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
