// One RPC to the main service (the one the app under test uses), for read-backs and restores only:
// a flow's coverage comes from the app sending its calls. Checks first who the main service is
// signed in as.
import {loadE2EAccounts} from '../accounts/env.ts'
import {convIDBytes} from './conv-id.ts'
import {connectPeerRpc} from './peer-rpc.ts'
import {mainSocketPath, mainWhoami, requireMainIsSmoke} from './peer-service.ts'

const call = async <T,>(method: string, arg: object): Promise<T> => {
  const rpc = await connectPeerRpc(mainSocketPath())
  try {
    return await rpc.call<T>(method, arg)
  } finally {
    rpc.close()
  }
}

export const mainRpc = async <T,>(method: string, arg: object): Promise<T> => {
  await requireMainIsSmoke(loadE2EAccounts())
  return call<T>(method, arg)
}

// The same while a flow has switched the app (and so the main service) to the second account,
// for a read-back of that account's own state.
export const mainRpcAsSecond = async <T,>(method: string, arg: object): Promise<T> => {
  const {secondUser} = loadE2EAccounts()
  const who = await mainWhoami()
  if (who !== secondUser) throw new Error(`the main keybase service is signed in as ${who || 'nobody'}, not the second account`)
  return call<T>(method, arg)
}

// One conversation as the main service localizes it for its signed-in account (the smoke account).
export type MainConversation = {
  info: {status: number}
  notifications?: {channelWide: boolean; settings?: Record<string, Record<string, boolean>> | null} | null
  readerInfo: {maxMsgid: number; readMsgid: number}
}
export const mainConversation = async (convID: string): Promise<MainConversation> => {
  const res = await mainRpc<{conversations?: Array<MainConversation> | null}>('chat.1.local.getInboxAndUnboxLocal', {
    identifyBehavior: 6, // chatSkip
    query: {computeActiveList: false, convIDs: [convIDBytes(convID)], readOnly: false, unreadOnly: false},
  })
  const conv = res.conversations?.[0]
  if (!conv) throw new Error('the main service reads no such conversation')
  return conv
}

// ConversationStatus in the protocol
export const conversationStatus = {blocked: 3, ignored: 2, muted: 4, unfiled: 0} as const

// Sets a conversation's status through the main service, for a restore only.
export const restoreConversationStatus = async (convID: string, status: number) => {
  await mainRpc('chat.1.local.SetConversationStatusLocal', {conversationID: convIDBytes(convID), identifyBehavior: 6, status})
}
