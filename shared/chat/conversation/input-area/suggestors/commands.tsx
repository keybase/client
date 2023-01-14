import * as Common from './common'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import {memoize} from '../../../../util/memoize'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import type * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
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

const ItemRenderer = (p: Common.ItemRendererProps<CommandType>) => {
  const {conversationIDKey, selected, item: command} = p
  const prefix = getCommandPrefix(command)
  const enabled = Container.useSelector(state => {
    const botSettings = state.chat2.botSettings.get(conversationIDKey)
    const suggestBotCommands = Constants.getBotCommands(state, conversationIDKey)
    const botRestrictMap = botSettings
      ? Constants.getBotRestrictBlockMap(botSettings, conversationIDKey, [
          ...suggestBotCommands
            .reduce<Set<string>>((s, c) => {
              c.username && s.add(c.username)
              return s
            }, new Set())
            .values(),
        ])
      : undefined
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
  conversationIDKey: Types.ConversationIDKey
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
  const {conversationIDKey, filter, inputRef, lastTextRef} = p

  return Container.useSelector(state => {
    const showCommandMarkdown = (state.chat2.commandMarkdownMap.get(conversationIDKey) || '') !== ''
    const showGiphySearch = state.chat2.giphyWindowMap.get(conversationIDKey) || false
    if (showCommandMarkdown || showGiphySearch) {
      return []
    }

    const suggestBotCommands = Constants.getBotCommands(state, conversationIDKey)
    const suggestCommands = Constants.getCommands(state, conversationIDKey)
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
  const {conversationIDKey} = p
  const items = useDataSource({conversationIDKey, filter, inputRef, lastTextRef})
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
