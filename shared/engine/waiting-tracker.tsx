// What one RPC shows on its waiting key. The service owes the GUI an answer (waiting) until it hands
// the GUI a prompt; while any prompt is held the GUI owes the service, so the key stops waiting unless
// the flow says the service is still working. Settled once, by whatever ends the RPC.
import type {RPCError} from '@/util/errors'
import {releaseOnce} from '@/util/release-once'
import type {WaitingChange, WaitingKey} from './types'

export type WaitingTracker = {
  // A prompt is held for the GUI; the release (answer, refusal, service cancel) runs once
  holdPrompt: () => () => void
  // The service works while a prompt is held; the release runs once, and settling ends it too
  holdServerWork: () => () => void
  // Ends the RPC. Only the first call does anything; it returns whether it was that one. An error is
  // recorded on the key even if it was not waiting.
  settle: (error?: RPCError) => boolean
}

export const makeWaitingTracker = (
  key: WaitingKey | undefined,
  emit: (change: WaitingChange) => void,
  log?: (waiting: boolean) => void
): WaitingTracker => {
  let settled = false
  let prompts = 0
  let serverWork = 0
  let waiting = false

  const show = (next: boolean, error?: RPCError) => {
    if (next === waiting) {
      return
    }
    waiting = next
    log?.(next)
    if (key) {
      emit(next ? {increment: true, key} : {error, increment: false, key})
    }
  }
  const update = () => show(!settled && (prompts === 0 || serverWork > 0))

  const hold = (change: (by: 1 | -1) => void) => {
    change(1)
    update()
    return releaseOnce(() => {
      change(-1)
      update()
    })
  }

  update()

  return {
    holdPrompt: () =>
      hold(by => {
        prompts += by
      }),
    holdServerWork: () =>
      hold(by => {
        serverWork += by
      }),
    settle: error => {
      if (settled) {
        return false
      }
      settled = true
      if (waiting) {
        show(false, error)
      } else if (error && key) {
        emit({error, key})
      }
      return true
    },
  }
}
