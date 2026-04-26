import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'
import * as React from 'react'
import * as T from '@/constants/types'
import * as Common from './common'
import * as Kb from '@/common-adapters'
import {useEngineActionListener} from '@/engine/action-listener'
import {useConfigState} from '@/stores/config'
import type {RefType as InputRef} from '../normal/input'

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

type BotSettingsMap = ReadonlyMap<string, T.RPCChat.Keybase1.TeamBotSettings | undefined>
type BotCommandsUpdateState = {
  conversationIDKey: T.Chat.ConversationIDKey
  settings: BotSettingsMap
  status: T.RPCChat.UIBotCommandsUpdateStatusTyp
}

const BotCommandSettingsContext = React.createContext<BotSettingsMap | undefined>(undefined)

const makeBotCommandsUpdateState = (conversationIDKey: T.Chat.ConversationIDKey): BotCommandsUpdateState => ({
  conversationIDKey,
  settings: new Map<string, T.RPCChat.Keybase1.TeamBotSettings | undefined>(),
  status: T.RPCChat.UIBotCommandsUpdateStatusTyp.blank,
})

export const useBotCommandsUpdateState = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const [updateState, setUpdateState] = React.useState(() => makeBotCommandsUpdateState(conversationIDKey))

  useEngineActionListener('chat.1.chatUi.chatBotCommandsUpdateStatus', action => {
    if (T.Chat.stringToConversationIDKey(action.payload.params.convID) !== conversationIDKey) {
      return
    }
    const {status} = action.payload.params
    setUpdateState(previous => {
      if (status.typ !== T.RPCChat.UIBotCommandsUpdateStatusTyp.uptodate) {
        const settings =
          previous.conversationIDKey === conversationIDKey
            ? previous.settings
            : new Map<string, T.RPCChat.Keybase1.TeamBotSettings | undefined>()
        return {conversationIDKey, settings, status: status.typ}
      }
      const settings = new Map<string, T.RPCChat.Keybase1.TeamBotSettings | undefined>()
      Object.entries(status.uptodate.settings ?? {}).forEach(([username, botSettings]) => {
        settings.set(username, botSettings)
      })
      return {conversationIDKey, settings, status: status.typ}
    })
  })

  return updateState.conversationIDKey === conversationIDKey
    ? updateState
    : makeBotCommandsUpdateState(conversationIDKey)
}

const getBotRestrictBlockMap = (
  settings: BotSettingsMap | undefined,
  conversationIDKey: T.Chat.ConversationIDKey,
  bots: ReadonlyArray<string>
) => {
  const blocks = new Map<string, boolean>()
  bots.forEach(b => {
    const botSettings = settings?.get(b)
    if (!botSettings) {
      blocks.set(b, false)
      return
    }
    const convs = botSettings.convs
    const cmds = botSettings.cmds
    blocks.set(b, !cmds || (!((convs?.length ?? 0) === 0) && !convs?.find(c => c === conversationIDKey)))
  })
  return blocks
}
const blankCommands: Array<T.RPCChat.ConversationCommand> = []

const ItemRenderer = (p: Common.ItemRendererProps<CommandType>) => {
  const {selected, item: command} = p
  const prefix = getCommandPrefix(command)
  const botSettings = React.useContext(BotCommandSettingsContext)
  const enabled = ConvoState.useChatContext(s => {
    const {botCommands} = s.meta
    const suggestBotCommands =
      botCommands.typ === T.RPCChat.ConversationCommandGroupsTyp.custom
        ? botCommands.custom.commands || blankCommands
        : blankCommands

    const botRestrictMap = getBotRestrictBlockMap(botSettings, s.id, [
      ...suggestBotCommands
        .reduce((s, c) => {
          if (c.username) {
            s.add(c.username)
          }
          return s
        }, new Set<string>())
        .values(),
    ])
    return !botRestrictMap.get(command.username ?? '')
  })
  return (
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      fullWidth={true}
      style={Kb.Styles.collapseStyles([
        Common.styles.suggestionBase,
        {backgroundColor: selected ? Kb.Styles.globalColors.blueLighter2 : Kb.Styles.globalColors.white},
        {alignItems: 'flex-start'},
      ])}
    >
      {!!command.username && <Kb.Avatar size={32} username={command.username} />}
      <Kb.Box2
        fullWidth={true}
        direction="vertical"
        style={Kb.Styles.collapseStyles([Common.styles.fixSuggestionHeight, {alignItems: 'flex-start'}])}
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
          <Kb.Text type="BodySmall" style={{color: Kb.Styles.globalColors.redDark}}>
            Bot disabled from listening
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

type UseDataSourceProps = {
  filter: string
  inputRef: React.RefObject<InputRef | null>
  lastTextRef: React.RefObject<string>
}

const useDataSource = (p: UseDataSourceProps) => {
  const {filter, inputRef, lastTextRef} = p
  const builtinCommands = useConfigState(s => s.chatBuiltinCommands)
  const showGiphySearch = ConvoState.useChatUIContext(s => s.giphyWindow)
  const showCommandMarkdown = ConvoState.useChatContext(s => !!s.commandMarkdown)
  return ConvoState.useChatContext(
    C.useShallow(s => {
      if (showCommandMarkdown || showGiphySearch) {
        return []
      }

      const {botCommands, commands} = s.meta
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

      const sel = inputRef.current?.getSelection()
      if (sel) {
        if (!lastTextRef.current) return []

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
        // we can't do a more robust check on `lastTextRef.current` because it's out of date.
        if (
          !(lastTextRef.current.startsWith('/') || lastTextRef.current.startsWith('!')) ||
          (sel.start || 0) > maxCmdLength
        ) {
          // not at beginning of message
          return []
        }
      }
      const fil = filter.toLowerCase()
      const data = (lastTextRef.current.startsWith('!') ? suggestBotCommands : suggestCommands).filter(c =>
        c.name.includes(fil)
      )
      return data
    })
  )
}

type CommandType = T.RPCChat.ConversationCommand
type ListProps = Pick<
  Common.ListProps<CommandType>,
  'expanded' | 'suggestBotCommandsUpdateStatus' | 'listStyle' | 'spinnerStyle'
> & {
  botSettings: BotSettingsMap
  filter: string
  onSelected: (item: CommandType, final: boolean) => void
  setOnMoveRef: (r: (up: boolean) => void) => void
  setOnSubmitRef: (r: () => boolean) => void
} & {
  inputRef: React.RefObject<InputRef | null>
  lastTextRef: React.RefObject<string>
}
export const List = (p: ListProps) => {
  const {botSettings, filter, inputRef, lastTextRef, ...rest} = p
  const items = useDataSource({filter, inputRef, lastTextRef})
  return (
    <BotCommandSettingsContext.Provider value={botSettings}>
      <Common.List
        {...rest}
        keyExtractor={keyExtractor}
        items={items}
        ItemRenderer={ItemRenderer}
        loading={false}
      />
    </BotCommandSettingsContext.Provider>
  )
}
