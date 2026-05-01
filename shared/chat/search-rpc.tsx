import * as T from '@/constants/types'

const makeSearchOpts = (overrides: Partial<T.RPCChat.SearchOpts>): T.RPCChat.SearchOpts => ({
  afterContext: 0,
  beforeContext: 0,
  isRegex: false,
  matchMentions: false,
  maxBots: 0,
  maxConvsHit: 0,
  maxConvsSearched: 0,
  maxHits: 0,
  maxMessages: -1,
  maxNameConvs: 0,
  maxTeams: 0,
  reindexMode: T.RPCChat.ReIndexingMode.postsearchSync,
  sentAfter: 0,
  sentBefore: 0,
  sentBy: '',
  sentTo: '',
  skipBotCache: false,
  ...overrides,
})

export const searchInboxRPC = async (p: {
  incomingCallMap: T.RPCChat.IncomingCallMapType
  opts: Partial<T.RPCChat.SearchOpts>
  query: string
}) => {
  return await T.RPCChat.localSearchInboxRpcListener({
    incomingCallMap: p.incomingCallMap,
    params: {
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      namesOnly: false,
      opts: makeSearchOpts(p.opts),
      query: p.query,
    },
  })
}

export const cancelActiveInboxSearchRPC = async () => {
  return await T.RPCChat.localCancelActiveInboxSearchRpcPromise()
}

export const cancelActiveThreadSearchRPC = async () => {
  return await T.RPCChat.localCancelActiveSearchRpcPromise()
}
