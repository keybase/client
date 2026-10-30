// The smoke account's blocks of the second account, read and put back through the host (the main
// service, signed in as the smoke account): for the block flow's restore, and for a refusal before
// any flow that needs the second account runs against a block a failed restore left.
import {loadE2EAccounts} from '../../accounts/env'
import {mainRpc} from '../../shared/main-rpc.ts'
import {blocksOf, secondBlockedProblem, type Blocks} from './blocks-lib.ts'

export const secondBlocks = async (): Promise<Blocks> => {
  const {secondUser} = loadE2EAccounts()
  const res = await mainRpc<Array<{chatBlocked?: boolean; followBlocked?: boolean; username: string}> | null>(
    'keybase.1.user.getUserBlocks',
    {sessionID: 0, usernames: [secondUser]}
  )
  return blocksOf(res, secondUser)
}

// Throws, saying why, when the smoke account blocks the second account. One host call.
export const requireSecondNotBlocked = async () => {
  const problem = secondBlockedProblem(await secondBlocks())
  if (problem) throw new Error(problem)
}

// Unblocks the second account through the host, for a restore only, and reads it back (20s).
export const unblockSecondOnHost = async () => {
  const {secondUser} = loadE2EAccounts()
  await mainRpc('keybase.1.user.setUserBlocks', {blocks: [{setChatBlock: false, setFollowBlock: false, username: secondUser}], sessionID: 0})
  const deadline = Date.now() + 20_000
  for (;;) {
    const now = await secondBlocks()
    if (!now.chatBlocked && !now.followBlocked) return
    if (Date.now() > deadline) throw new Error(`the second account is still blocked after the host's unblock: ${JSON.stringify(now)}`)
    await new Promise(resolve => setTimeout(resolve, 1_000))
  }
}
