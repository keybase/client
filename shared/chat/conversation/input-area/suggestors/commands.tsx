import * as Common from './common'
import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import type * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import type * as TeamsTypes from '../../../../constants/types/teams'
import type * as Types from '../../../../constants/types/chat2'

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

export const Renderer = (p: any) => {
  const selected: boolean = p.selected
  const conversationIDKey: Types.ConversationIDKey = p.conversationIDKey
  const command: RPCChatTypes.ConversationCommand = p.value
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

export const useDataSource = (
  _active: string,
  _conversationIDKey: Types.ConversationIDKey,
  _filter: string
) => {
  return null
  // const isActive =  (active === 'commands')

  //   return Container.useSelector(state => {
  //       if (!isActive) return null

  //       // TODO remove from store
  //   const showCommandMarkdown = (state.chat2.commandMarkdownMap.get(conversationIDKey) || '') !== ''
  //   const showGiphySearch = state.chat2.giphyWindowMap.get(conversationIDKey) || false
  // if (showCommandMarkdown || showGiphySearch) {
  //   return {
  //     data: [],
  //     loading: false,
  //     useSpaces: true,
  //   }
  // }

  // const sel = this._input?.getSelection()
  // if (sel && this._lastText) {
  //   // a little messy. Check if the message starts with '/' and that the cursor is
  //   // within maxCmdLength chars away from it. This happens before `onChangeText`, so
  //   // we can't do a more robust check on `this._lastText` because it's out of date.
  //   if (
  //     !(this._lastText.startsWith('/') || this._lastText.startsWith('!')) ||
  //     (sel.start || 0) > this._maxCmdLength
  //   ) {
  //     // not at beginning of message
  //     return {
  //       data: [],
  //       loading: false,
  //       useSpaces: true,
  //     }
  //   }
  // }
  // const fil = filter.toLowerCase()
  // const data = (
  //   this._lastText?.startsWith('!') ? this.props.suggestBotCommands : this.props.suggestCommands
  // ).filter(c => c.name.includes(fil))
  // return {
  //   data,
  //   loading: false,
  //   useSpaces: true,
  // }

  //   })
}
export const List = () => {
  return null
}
