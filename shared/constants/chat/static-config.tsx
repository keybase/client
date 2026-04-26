import * as Message from './message'
import * as T from '@/constants/types'

const emptyBuiltinCommands = (): T.Chat.StaticConfig['builtinCommands'] => ({
  [T.RPCChat.ConversationBuiltinCommandTyp.none]: [],
  [T.RPCChat.ConversationBuiltinCommandTyp.adhoc]: [],
  [T.RPCChat.ConversationBuiltinCommandTyp.smallteam]: [],
  [T.RPCChat.ConversationBuiltinCommandTyp.bigteam]: [],
  [T.RPCChat.ConversationBuiltinCommandTyp.bigteamgeneral]: [],
})

export const serviceStaticConfigToStaticConfig = (
  staticConfig: T.RPCChat.StaticConfig
): T.Chat.StaticConfig | undefined => {
  const {deletableByDeleteHistory} = staticConfig
  if (!deletableByDeleteHistory) {
    return undefined
  }
  return {
    builtinCommands: (staticConfig.builtinCommands || []).reduce<T.Chat.StaticConfig['builtinCommands']>(
      (map, c) => {
        map[c.typ] = c.commands ? [...c.commands] : []
        return map
      },
      emptyBuiltinCommands()
    ),
    deletableByDeleteHistory: new Set(
      deletableByDeleteHistory.reduce<Array<T.Chat.MessageType>>((res, type) => {
        const ourTypes = Message.serviceMessageTypeToMessageTypes(type)
        res.push(...ourTypes)
        return res
      }, [])
    ),
  }
}
