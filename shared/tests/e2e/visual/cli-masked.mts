// readCli for reads whose error lands in run output: the test accounts and team in it are named by
// role (see maskAccounts).
import {maskAccounts} from '../accounts/sweep-lib.ts'
import {e2eAccounts} from '../shared/chat-data.ts'
import {readCli} from '../shared/cli-read.ts'
import type {E2EAccounts} from '../accounts/env.ts'

export const maskedError = (e: unknown, a: E2EAccounts) =>
  new Error(
    maskAccounts(e instanceof Error ? e.message : String(e), {team: a.team, users: {second: a.secondUser, smoke: a.smokeUser}})
  )

export const readCliMasked = async (args: ReadonlyArray<string>, what: string): Promise<string> => {
  try {
    return await readCli(args, what)
  } catch (e) {
    let accounts: E2EAccounts
    try {
      accounts = e2eAccounts()
    } catch {
      // no accounts configured, so none to name
      throw e
    }
    throw maskedError(e, accounts)
  }
}
