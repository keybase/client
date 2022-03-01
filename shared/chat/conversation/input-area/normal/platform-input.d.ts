import * as React from 'react'
import type * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import type * as Types from '../../../../constants/types/chat2'
import type * as TeamTypes from '../../../../constants/types/teams'
import type {PlainInput} from '../../../../common-adapters'

type Props = {
  dataSources: unknown
  keyExtractors: unknown
  onBlur: unknown
  onFocus: unknown
  onSelectionChange: unknown
  renderers: unknown
  suggestionListStyle: unknown
  suggestionOverlayStyle: unknown
  suggestionSpinnerStyle: unknown
  suggestorToMarker: unknown
  transformers: unknown
  // botRestrictMap?: Map<string, boolean>
  onKeyDown: (evt: React.KeyboardEvent) => void
  cannotWrite: boolean
  showWalletsIcon: boolean
  inputSetRef: React.MutableRefObject<PlainInput>
  // clearInboxFilter: () => void
  conversationIDKey: Types.ConversationIDKey
  // editText: string
  explodingModeSeconds: number
  // getUnsentText: () => string
  inputHintText: string
  onChangeText: (newText: string) => void
  // isEditExploded: boolean
  isEditing: boolean
  isExploding: boolean
  // isSearching: boolean
  // maxInputArea?: number
  minWriterRole: TeamTypes.TeamRoleType
  // onAttach: (paths: Array<string>) => void
  onCancelEditing: () => void
  onCancelReply: () => void
  onEditLastMessage: () => void
  // onFilePickerError: (error: Error) => void
  // onGiphyToggle: () => void
  onRequestScrollDown: () => void
  onRequestScrollUp: () => void
  // onSubmit: (text: string) => void
  onChannelSuggestionsTriggered: () => void
  onFetchEmoji: () => void
  // prependText: string | null
  // quoteCounter: number
  // quoteText: string
  // sendTyping: (typing: boolean) => void
  // setUnsentText: (text: string) => void
  // showCommandMarkdown: boolean
  // showCommandStatus: boolean
  // showGiphySearch: boolean
  showReplyPreview: boolean
  // showTypingStatus: boolean
  // unsentText: string | null
  // unsentTextChanged: (text: string) => void
  suggestBotCommandsUpdateStatus: RPCChatTypes.UIBotCommandsUpdateStatusTyp
  userEmojisLoading: boolean
}

// export type InputProps = {
//   infoPanelShowing: boolean
//   isActiveForFocus: boolean
//   suggestTeams: Array<{
//     username: string
//     fullName: string
//     teamname: string
//   }>
//   suggestUsers: Array<{
//     username: string
//     fullName: string
//     teamname?: string
//   }>
//   suggestChannels: Array<{
//     channelname: string
//     teamname?: string
//   }>
//   suggestChannelsLoading: boolean
//   suggestAllChannels: Array<{
//     teamname: string
//     channelname: string
//   }>
//   suggestCommands: Array<RPCChatTypes.ConversationCommand>
//   suggestBotCommands: Array<RPCChatTypes.ConversationCommand>
//   userEmojis?: Array<RPCChatTypes.Emoji>
// } & CommonProps

// export type PlatformInputProps = {
//   setHeight: (inputHeight: number) => void
// } & CommonProps
// }

export default class PlatformInput extends React.Component<Props> {}
