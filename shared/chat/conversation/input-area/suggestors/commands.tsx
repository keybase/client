import * as C from '../../../../constants'
import * as Common from './common'
import {memoize} from '../../../../util/memoize'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import type * as Types from '../../../../constants/types/chat2'
import shallowEqual from 'shallowequal'

const getCommandPrefix = (command: RPCChatTypes.ConversationCommand) => {
  return command.username ? '!' : '/'
}

export const transformer = (
  command: RPCChatTypes.ConversationCommand,
  _: unknown,
  tData: Common.TransformerData,
  preview: boolean
) => {
  const prefix = getCommandPrefix(command)
  return Common.standardTransformer(`${prefix}${command.name}`, tData, preview)
}

export const keyExtractor = (c: RPCChatTypes.ConversationCommand) => c.name + c.username

const getBotRestrictBlockMap = (
  settings: Map<string, RPCChatTypes.Keybase1.TeamBotSettings | undefined>,
  conversationIDKey: Types.ConversationIDKey,
  bots: Array<string>
) => {
  const blocks = new Map<string, boolean>()
  bots.forEach(b => {
    const botSettings = settings.get(b)
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
const blankCommands: Array<RPCChatTypes.ConversationCommand> = []
const ItemRenderer = (p: Common.ItemRendererProps<CommandType>) => {
  const {selected, item: command} = p
  const prefix = getCommandPrefix(command)
  const botSettings = C.useChatContext(s => s.botSettings)
  const enabled = C.useChatContext(s => {
    const {botCommands} = s.meta
    const suggestBotCommands =
      botCommands.typ === RPCChatTypes.ConversationCommandGroupsTyp.custom
        ? botCommands.custom.commands || blankCommands
        : blankCommands

    const botRestrictMap = getBotRestrictBlockMap(botSettings, s.id, [
      ...suggestBotCommands
        .reduce<Set<string>>((s, c) => {
          c.username && s.add(c.username)
          return s
        }, new Set())
        .values(),
    ])
    return !botRestrictMap?.get(command.username ?? '') ?? true
  })
  return (
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      fullWidth={true}
      style={Styles.collapseStyles([
        Common.styles.suggestionBase,
        {backgroundColor: selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white},
        {alignItems: 'flex-start'},
      ])}
    >
      {!!command.username && <Kb.Avatar size={32} username={command.username} />}
      <Kb.Box2
        fullWidth={true}
        direction="vertical"
        style={Styles.collapseStyles([Common.styles.fixSuggestionHeight, {alignItems: 'flex-start'}])}
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
          <Kb.Text type="BodySmall" style={{color: Styles.globalColors.redDark}}>
            Command unavailable due to bot restriction configuration.
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

type UseDataSourceProps = {
  filter: string
  inputRef: React.MutableRefObject<Kb.PlainInput | null>
  lastTextRef: React.MutableRefObject<string>
}

const getMaxCmdLength = memoize(
  (
    suggestBotCommands: Array<RPCChatTypes.ConversationCommand>,
    suggestCommands: Array<RPCChatTypes.ConversationCommand>
  ) =>
    suggestCommands
      .concat(suggestBotCommands || [])
      .reduce((max, cmd) => (cmd.name.length > max ? cmd.name.length : max), 0) + 1
)

export const useDataSource = (p: UseDataSourceProps) => {
  const {filter, inputRef, lastTextRef} = p
  const staticConfig = C.useChatState(s => s.staticConfig)
  const showGiphySearch = C.useChatContext(s => s.giphyWindow)
  const showCommandMarkdown = C.useChatContext(s => !!s.commandMarkdown)
  return C.useChatContext(s => {
    if (showCommandMarkdown || showGiphySearch) {
      return []
    }

    const {botCommands, commands} = s.meta
    const suggestBotCommands =
      botCommands.typ === RPCChatTypes.ConversationCommandGroupsTyp.custom
        ? botCommands.custom.commands || blankCommands
        : blankCommands
    const suggestCommands =
      commands.typ === RPCChatTypes.ConversationCommandGroupsTyp.builtin
        ? staticConfig
          ? staticConfig.builtinCommands[commands.builtin] || blankCommands
          : blankCommands
        : blankCommands

    const sel = inputRef.current?.getSelection()
    if (sel && lastTextRef.current) {
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
    const data = (lastTextRef.current?.startsWith('!') ? suggestBotCommands : suggestCommands).filter(c =>
      c.name.includes(fil)
    )
    return data
  }, shallowEqual)
}

type CommandType = RPCChatTypes.ConversationCommand
type ListProps = Pick<
  Common.ListProps<CommandType>,
  'expanded' | 'suggestBotCommandsUpdateStatus' | 'listStyle' | 'spinnerStyle'
> & {
  conversationIDKey: Types.ConversationIDKey
  filter: string
  onSelected: (item: CommandType, final: boolean) => void
  onMoveRef: React.MutableRefObject<((up: boolean) => void) | undefined>
  onSubmitRef: React.MutableRefObject<(() => boolean) | undefined>
} & {
  inputRef: React.MutableRefObject<Kb.PlainInput | null>
  lastTextRef: React.MutableRefObject<string>
}
export const List = (p: ListProps) => {
  const {filter, inputRef, lastTextRef, ...rest} = p
  const items = useDataSource({filter, inputRef, lastTextRef})
  return (
    <Common.List
      {...rest}
      keyExtractor={keyExtractor}
      items={items}
      ItemRenderer={ItemRenderer}
      loading={false}
    />
  )
}
