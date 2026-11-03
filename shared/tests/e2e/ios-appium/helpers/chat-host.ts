// What the chat flows read off the host (the smoke account's own service, or its CLI), polled until
// it answers, and the fixtures they share: the second account's peer sender and the throwaway
// channels a test makes.
import {loadE2EEnv} from '../../accounts/env'
import {createThrowawayChannel, deleteThrowawayChannel, readFromCli, type CliMessage} from '../../shared/chat-data'
import {mainConversation, type MainConversation} from '../../shared/main-rpc.ts'
import {peerSender, type IncomingSender} from '../../shared/peer-actors'
import {waitFor} from './lifecycle'

// Polls `read` until `ok` takes what it answers. Bound: 20, overrun by one read.
export const expectHost = async <V,>(what: string, read: () => Promise<V>, ok: (v: V) => boolean) =>
  waitFor(`the host to read ${what}`, async () => (ok(await read()) ? true : undefined), {interval: 1_000, timeout: 20_000})

type CliWhere = {topicName: string} | {tlfName: string}

// Polls the host's CLI read of a conversation until `ok` takes its messages.
export const expectCli = async (where: CliWhere, what: string, ok: (ms: Array<CliMessage>) => boolean) =>
  expectHost(what, async () => readFromCli(where), ok)

export const textBodies = (ms: Array<CliMessage>) => ms.filter(m => m.content.type === 'text').map(m => m.content.text?.body ?? '')

// A conversation's status (ConversationStatus) as the host reads it.
export const convStatus = async (convID: string) => (await mainConversation(convID)).info.status
export const expectConvStatus = async (what: string, convID: string, want: number) =>
  expectHost(what, async () => convStatus(convID), s => s === want)

// The id of the message the host reads as the conversation's pin, or null when nothing is pinned.
type WithPin = MainConversation & {
  info: {pinnedMsg?: {message?: {valid?: {serverHeader?: {messageID?: number}}}} | null}
}
export const pinnedOnHost = async (convID: string) =>
  ((await mainConversation(convID)) as WithPin).info.pinnedMsg?.message?.valid?.serverHeader?.messageID ?? null

// The second account's peer service, found by the first test that needs it and kept for the run. A
// lookup that fails is not kept: it fails the test that asked, with the reason, and the next test
// that needs the peer looks again.
let second: Promise<IncomingSender> | undefined
export const secondSender = async () =>
  (second ??= peerSender(loadE2EEnv()).catch((e: unknown) => {
    second = undefined
    throw e
  }))

// The throwaway channels of KB_E2E_TEAM one flow makes, each noted once made so the flow's
// afterEach deletes it. Bound of deleteAll: deleteThrowawayChannel 120 a channel.
export const throwawayChannels = () => {
  const made = new Set<string>()
  return {
    deleteAll: async () => {
      for (const topicName of [...made]) {
        await deleteThrowawayChannel(topicName)
        made.delete(topicName)
      }
    },
    make: async (label: string, opts?: {withSecond?: boolean}) => {
      const channel = await createThrowawayChannel(label, opts)
      made.add(channel.topicName)
      return channel
    },
  }
}
