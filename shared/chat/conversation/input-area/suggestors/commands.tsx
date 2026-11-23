import * as React from 'react'
import * as T from '@/constants/types'
import * as Common from './common'
import * as Kb from '@/common-adapters'
import {useConversationThreadID, useConversationThreadNotifications} from '../../thread-context'
import {useConfigState} from '@/stores/config'
import type {Selection as InputSelection} from '../normal/input.shared'
import {useConversationMeta} from '../../data-hooks'

const getCommandPrefix = (command: T.RPCChat.ConversationCommand) => {
  return command.username ? '!' : '/'
}

export const transformer = (
  command: T.RPCChat.ConversationCommand,
  _: unknown,
  tData: Common.TransformerData,
  preview: boolean
) => {
  const prefix = getCommandPrefix(command)
  return Common.standardTransformer(`${prefix}${command.name}`, tData, preview)
}

const keyExtractor = (c: T.RPCChat.ConversationCommand) => c.name + String(c.username)

type BlockedBots = ReadonlySet<string>
type BotCommandsUpdateState = {
  conversationIDKey: T.Chat.ConversationIDKey
  // bots whose restricted settings keep them from taking commands here, as the service decided
  blockedBots: BlockedBots
  status: T.RPCChat.UIBotCommandsUpdateStatusTyp
}

const noBlockedBots: BlockedBots = new Set()
const BlockedBotsContext = React.createContext<BlockedBots>(noBlockedBots)
BlockedBotsContext.displayName = 'BlockedBotsContext'

const makeBotCommandsUpdateState = (conversationIDKey: T.Chat.ConversationIDKey): BotCommandsUpdateState => ({
  blockedBots: noBlockedBots,
  conversationIDKey,
  status: T.RPCChat.UIBotCommandsUpdateStatusTyp.blank,
})

export const useBotCommandsUpdateState = () => {
  const conversationIDKey = useConversationThreadID()
  const [updateState, setUpdateState] = React.useState(() => makeBotCommandsUpdateState(conversationIDKey))
  useConversationThreadNotifications(notification => {
    if (notification.type !== 'botCommandsUpdateStatus') {
      return
    }
    const {status} = notification
    setUpdateState(previous => {
      if (status.typ !== T.RPCChat.UIBotCommandsUpdateStatusTyp.uptodate) {
        const blockedBots = previous.conversationIDKey === conversationIDKey ? previous.blockedBots : noBlockedBots
        return {blockedBots, conversationIDKey, status: status.typ}
      }
      return {
        blockedBots: new Set(status.uptodate.commandsBlocked ?? []),
        conversationIDKey,
        status: status.typ,
      }
    })
  })

  return updateState.conversationIDKey === conversationIDKey
    ? updateState
    : makeBotCommandsUpdateState(conversationIDKey)
}

const blankCommands: Array<T.RPCChat.ConversationCommand> = []

// two stacked lines, whose desktop line-heights are 18 (Body) and 17 (BodySmall); this is
// taller than the optional leading avatar. Long descriptions can wrap and exceed this.
const rowHeight = Common.desktopRowHeight(18 + 17)

const ItemRenderer = (p: Common.ItemRendererProps<CommandType>) => {
  const styles = Common.useStyles()
  const theme = Kb.Styles.useTheme()
  const {selected, item: command} = p
  const prefix = getCommandPrefix(command)
  const blockedBots = React.useContext(BlockedBotsContext)
  const enabled = !blockedBots.has(command.username ?? '')
  return (
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      fullWidth={true}
      alignItems="flex-start"
      style={Kb.Styles.collapseStyles([
        styles.suggestionBase,
        {backgroundColor: selected ? theme.blueLighter2 : theme.white},
      ])}
    >
      {!!command.username && <Kb.Avatar size={Common.avatarSize} username={command.username} />}
      <Kb.Box2
        fullWidth={true}
        direction="vertical"
        alignItems="flex-start"
        style={styles.fixSuggestionHeight}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny">
          <Kb.Text type="BodySemibold">
            {prefix}
            {command.name}
          </Kb.Text>
          <Kb.Text type="Body">{command.usage}</Kb.Text>
        </Kb.Box2>
        {enabled ? (
          <Kb.Text type="BodySmall">{command.description}</Kb.Text>
        ) : (
          <Kb.Text type="BodySmall" style={{color: theme.redDark}}>
            Bot disabled from listening
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

export type CommandInputSnapshot = {
  selection: InputSelection | undefined
  text: string
}

type UseDataSourceProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  filter: string
  inputSnapshot: CommandInputSnapshot
  suppressCommandSuggestions: boolean
}

const useDataSource = (p: UseDataSourceProps) => {
  const {conversationIDKey, filter, inputSnapshot, suppressCommandSuggestions} = p
  const {selection: sel, text} = inputSnapshot
  const builtinCommands = useConfigState(s => s.chatBuiltinCommands)
  const {botCommands, commands} = useConversationMeta(conversationIDKey)
  if (suppressCommandSuggestions) {
    return []
  }

  const suggestBotCommands =
    botCommands.typ === T.RPCChat.ConversationCommandGroupsTyp.custom
      ? botCommands.custom.commands || blankCommands
      : blankCommands
  const suggestCommands =
    commands.typ === T.RPCChat.ConversationCommandGroupsTyp.builtin
      ? builtinCommands
        ? builtinCommands[commands.builtin]
        : blankCommands
      : blankCommands

  if (sel) {
    if (!text) return []

    const getMaxCmdLength = (
      suggestBotCommands: ReadonlyArray<T.RPCChat.ConversationCommand>,
      suggestCommands: ReadonlyArray<T.RPCChat.ConversationCommand>
    ) =>
      suggestCommands
        .concat(suggestBotCommands)
        .reduce((max, cmd) => (cmd.name.length > max ? cmd.name.length : max), 0) + 1
    const maxCmdLength = getMaxCmdLength(suggestBotCommands, suggestCommands)

    // a little messy. Check if the message starts with '/' and that the cursor is
    // within maxCmdLength chars away from it. This happens before `onChangeText`, so
    // we can't do a more robust check on `text` because it can be out of date.
    if (!(text.startsWith('/') || text.startsWith('!')) || (sel.start || 0) > maxCmdLength) {
      // not at beginning of message
      return []
    }
  }
  const fil = filter.toLowerCase()
  return (text.startsWith('!') ? suggestBotCommands : suggestCommands).filter(c => c.name.includes(fil))
}

type CommandType = T.RPCChat.ConversationCommand
type ListProps = Pick<
  Common.ListProps<CommandType>,
  'suggestBotCommandsUpdateStatus' | 'listStyle' | 'spinnerStyle'
> & {
  blockedBots: BlockedBots
  conversationIDKey: T.Chat.ConversationIDKey
  filter: string
  onSelected: (item: CommandType, final: boolean) => void
  setListHandle: (h: Common.ListHandle | undefined) => void
  suppressCommandSuggestions: boolean
} & {
  inputSnapshot: CommandInputSnapshot
}
export const List = (p: ListProps) => {
  const {blockedBots, conversationIDKey, filter, inputSnapshot, suppressCommandSuggestions, ...rest} = p
  const items = useDataSource({conversationIDKey, filter, inputSnapshot, suppressCommandSuggestions})
  return (
    <BlockedBotsContext value={blockedBots}>
      <Common.List
        {...rest}
        filter={filter}
        keyExtractor={keyExtractor}
        items={items}
        ItemRenderer={ItemRenderer}
        loading={false}
        rowHeight={rowHeight}
      />
    </BlockedBotsContext>
  )
}
