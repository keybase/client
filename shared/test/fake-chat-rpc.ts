// The in-memory ChatThreadRpc adapter: the second implementation of the seam, so a chat test
// scripts the service instead of spying on generated functions. It records every call in order,
// and each method answers from a script: `on` for every call from then on, `once` for the next
// call only (queued ahead of `on`).
//
// Unscripted, a method that returns nothing resolves; one that returns data rejects, so a test
// can never read a made-up answer it did not ask for. loadThread resolves {offline: false}
// without streaming anything.
//
// A script for loadThread or postText gets the caller's params, callbacks included, and streams
// by calling them: p.onCachedThread(json), p.onFullThread(json), p.onThreadStatus(status),
// p.onStellarCanceled().
import {setChatRpc, type ChatThreadRpc} from '@/chat/conversation/chat-rpc'
import {isChatSessionReady} from '@/stores/config'

export type ChatRpcMethod = keyof ChatThreadRpc
type Args<M extends ChatRpcMethod> = Parameters<ChatThreadRpc[M]>
type Result<M extends ChatRpcMethod> = Awaited<ReturnType<ChatThreadRpc[M]>>
export type ChatRpcScript<M extends ChatRpcMethod> = (...args: Args<M>) => Result<M> | Promise<Result<M>>

export type FakeChatRpc = ChatThreadRpc & {
  // every call, in order, across methods
  log: Array<{method: ChatRpcMethod; args: ReadonlyArray<unknown>}>
  // each call's arguments
  calls: <M extends ChatRpcMethod>(method: M) => Array<Args<M>>
  // each call's first argument: the params object for most methods
  params: <M extends ChatRpcMethod>(method: M) => Array<Args<M>[0]>
  on: <M extends ChatRpcMethod>(method: M, script: ChatRpcScript<M>) => void
  once: <M extends ChatRpcMethod>(method: M, script: ChatRpcScript<M>) => void
  fail: (method: ChatRpcMethod, error: unknown) => void
  failOnce: (method: ChatRpcMethod, error: unknown) => void
  clearLog: () => void
}

const unscripted = (method: string) => () => {
  throw new Error(`FakeChatRpc.${method} has no scripted result`)
}
const nothing = () => undefined

const defaultScripts: {[M in ChatRpcMethod]: ChatRpcScript<M>} = {
  addBotMember: nothing,
  addTeamMemberAfterReset: nothing,
  addToConversation: nothing,
  cancelPost: nothing,
  cancelUploadTempFile: nothing,
  clearExplodingMode: nothing,
  createAdhocConversation: unscripted('createAdhocConversation'),
  deleteHistory: nothing,
  dismissBlockButtons: nothing,
  dismissJourneycard: nothing,
  downloadAttachment: unscripted('downloadAttachment'),
  forwardMessage: nothing,
  getBotSettings: unscripted('getBotSettings'),
  getBotTeamRole: unscripted('getBotTeamRole'),
  getNextAttachment: unscripted('getNextAttachment'),
  getUnfurlPreviews: unscripted('getUnfurlPreviews'),
  getUnreadline: unscripted('getUnreadline'),
  getUploadTempFile: unscripted('getUploadTempFile'),
  ignorePinnedMessage: nothing,
  joinConversation: nothing,
  listPublicBotCommands: unscripted('listPublicBotCommands'),
  loadGallery: unscripted('loadGallery'),
  loadThread: () => ({offline: false}),
  makeAudioPreview: unscripted('makeAudioPreview'),
  makeUploadTempFile: unscripted('makeUploadTempFile'),
  markRead: nothing,
  markTeamRead: nothing,
  pinMessage: nothing,
  postAttachment: nothing,
  postDelete: nothing,
  postEdit: nothing,
  postReaction: nothing,
  postText: nothing,
  previewConversation: unscripted('previewConversation'),
  refreshParticipants: nothing,
  removeBotMember: nothing,
  resolveUnfurlPrompt: nothing,
  retryPost: nothing,
  saveDraft: nothing,
  searchBotDestinations: unscripted('searchBotDestinations'),
  searchForwardDestinations: unscripted('searchForwardDestinations'),
  setBotSettings: nothing,
  setConversationStatus: nothing,
  setExplodingMode: nothing,
  setMinWriterRole: nothing,
  setNotificationSettings: nothing,
  setTyping: nothing,
  showPendingRekeyStatus: nothing,
  toggleCollapse: nothing,
  trackGiphySelect: nothing,
  unpinMessage: nothing,
  updateLocation: nothing,
}

const methods = Object.keys(defaultScripts) as Array<ChatRpcMethod>

export const makeFakeChatRpc = (): FakeChatRpc => {
  const log: FakeChatRpc['log'] = []
  const scripts = new Map<ChatRpcMethod, (...args: ReadonlyArray<unknown>) => unknown>()
  const queued = new Map<ChatRpcMethod, Array<(...args: ReadonlyArray<unknown>) => unknown>>()

  const invoke = (method: ChatRpcMethod, args: ReadonlyArray<unknown>) => {
    // part of loadThread's contract, so every adapter honours it
    if (method === 'loadThread' && !isChatSessionReady()) {
      return undefined
    }
    log.push({args, method})
    const script =
      queued.get(method)?.shift() ??
      scripts.get(method) ??
      (defaultScripts[method] as (...args: ReadonlyArray<unknown>) => unknown)
    return script(...args)
  }

  // a script that throws rejects, as a service error would, rather than throwing at the caller
  const adapter = Object.fromEntries(
    methods.map(method => [
      method,
      async (...args: ReadonlyArray<unknown>) => await Promise.resolve(invoke(method, args)),
    ])
  ) as unknown as ChatThreadRpc

  const calls = <M extends ChatRpcMethod>(method: M) =>
    log.filter(c => c.method === method).map(c => c.args as Args<M>)

  const enqueue = (method: ChatRpcMethod, script: (...args: ReadonlyArray<unknown>) => unknown) => {
    const q = queued.get(method) ?? []
    q.push(script)
    queued.set(method, q)
  }
  const thrower = (error: unknown) => () => {
    throw error
  }

  return {
    ...adapter,
    calls,
    clearLog: () => {
      log.length = 0
    },
    fail: (method, error) => {
      scripts.set(method, thrower(error))
    },
    failOnce: (method, error) => {
      enqueue(method, thrower(error))
    },
    log,
    on: (method, script) => {
      scripts.set(method, script as (...args: ReadonlyArray<unknown>) => unknown)
    },
    once: (method, script) => {
      enqueue(method, script as (...args: ReadonlyArray<unknown>) => unknown)
    },
    params: <M extends ChatRpcMethod>(method: M) => calls(method).map(args => args[0] as Args<M>[0]),
  }
}

export const installFakeChatRpc = () => {
  const fake = makeFakeChatRpc()
  setChatRpc(fake)
  return fake
}

export const restoreChatRpc = () => {
  setChatRpc()
}
