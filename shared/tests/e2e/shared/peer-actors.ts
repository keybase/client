// The other accounts' side of the chat flows, played by the peer services (peer-service.ts): the
// second account sends and types from its own device, and the team owner (the smoke account on its
// own device) changes channels. The desktop CLI cannot do either while it talks to the app's own
// service, which is whoever the app is signed in as.
//
// A peer that is missing, stopped or signed in as someone else fails the call naming the peer.
import type {E2EEnv} from '../accounts/env.ts'
import {convIDBytes} from './conv-id.ts'
import {ensurePeer, type Peer} from './peer-service.ts'

export type IncomingSender = {
  send: (conversationIDKey: string, text: string) => Promise<void>
  // tells the conversation's other members the second account is typing (or stopped)
  typing: (conversationIDKey: string, on: boolean) => Promise<void>
}

// TeamRole in the protocol
const teamRoles = {admin: 3, none: 0, writer: 2} as const

export type ChannelOwner = {
  removeFromChannel: (conversationIDKey: string, username: string) => Promise<void>
  // the lowest team role that can post in the channel: 'none' lets every member post
  setMinWriterRole: (conversationIDKey: string, role: keyof typeof teamRoles) => Promise<void>
}

const rpcCall = async (peer: Peer, method: string, arg: object) => {
  const rpc = await peer.rpc()
  try {
    await rpc.call(method, arg, 20_000)
  } catch (e) {
    throw new Error(`peer ${peer.role} at ${peer.home}: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
  } finally {
    rpc.close()
  }
}

export const senderFrom = (peer: Peer): IncomingSender => ({
  send: async (conversationIDKey, text) => {
    await peer.chatApi({
      method: 'send',
      params: {options: {conversation_id: conversationIDKey, message: {body: text}}},
    })
  },
  typing: async (conversationIDKey, on) =>
    rpcCall(peer, 'chat.1.local.updateTyping', {conversationID: convIDBytes(conversationIDKey), typing: on}),
})

export const channelOwnerFrom = (peer: Peer): ChannelOwner => ({
  removeFromChannel: async (conversationIDKey, username) => {
    await peer.chatApi({
      method: 'removefromchannel',
      params: {options: {conversation_id: conversationIDKey, usernames: [username]}},
    })
  },
  setMinWriterRole: async (conversationIDKey, role) =>
    rpcCall(peer, 'chat.1.local.setConvMinWriterRoleLocal', {
      convID: convIDBytes(conversationIDKey),
      role: teamRoles[role],
    }),
})

// The second account, from its peer service.
export const peerSender = async (env: E2EEnv) => senderFrom(await ensurePeer('second', env))

// The team owner, from its peer service.
export const peerChannelOwner = async (env: E2EEnv) => channelOwnerFrom(await ensurePeer('owner', env))
