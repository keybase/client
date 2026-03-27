import * as T from '@/constants/types'
import {ignorePromise, wrapErrors} from '@/constants/utils'
import * as Z from '@/util/zustand'
import {RPCError} from '@/util/errors'
import {navigateAppend} from '@/constants/router'

type GeneratePgpArgs = {
  pgpEmail1: string
  pgpEmail2: string
  pgpEmail3: string
  pgpFullName: string
}

export type State = {
  dispatch: {
    dynamic: {
      cancelPgpGen?: () => void
      finishedWithKeyGen?: (shouldStoreKeyOnServer: boolean) => void
    }
    generatePgp: (args: GeneratePgpArgs) => void
    resetState: () => void
  }
}

export const useProfileState = Z.createZustand<State>('profile', set => {
  const resetPgpCallbacks = () => {
    set(s => {
      s.dispatch.dynamic.cancelPgpGen = undefined
      s.dispatch.dynamic.finishedWithKeyGen = undefined
    })
  }

  const dispatch: State['dispatch'] = {
    dynamic: {
      cancelPgpGen: undefined,
      finishedWithKeyGen: undefined,
    },
    generatePgp: args => {
      const f = async () => {
        let canceled = false
        let pgpKeyString = 'Error getting public key...'
        const ids = [args.pgpEmail1, args.pgpEmail2, args.pgpEmail3].filter(Boolean).map(email => ({
          comment: '',
          email: email || '',
          username: args.pgpFullName || '',
        }))

        navigateAppend('profileGenerate')
        set(s => {
          s.dispatch.dynamic.cancelPgpGen = wrapErrors(() => {
            canceled = true
          })
        })

        try {
          await T.RPCGen.pgpPgpKeyGenDefaultRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.pgpUi.keyGenerated': ({key}, response) => {
                if (canceled) {
                  response.error({code: T.RPCGen.StatusCode.scinputcanceled, desc: 'Input canceled'})
                } else {
                  pgpKeyString = key.key
                  response.result()
                }
              },
              'keybase.1.pgpUi.shouldPushPrivate': ({prompt}, response) => {
                navigateAppend({
                  name: 'profileFinished',
                  params: {pgpKeyString, promptShouldStoreKeyOnServer: prompt},
                })
                set(s => {
                  s.dispatch.dynamic.finishedWithKeyGen = wrapErrors((shouldStoreKeyOnServer: boolean) => {
                    set(s => {
                      s.dispatch.dynamic.finishedWithKeyGen = undefined
                    })
                    response.result(shouldStoreKeyOnServer)
                  })
                })
              },
            },
            incomingCallMap: {'keybase.1.pgpUi.finished': () => {}},
            params: {createUids: {ids, useDefault: false}},
          })
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          if (error.code !== T.RPCGen.StatusCode.scinputcanceled) {
            throw error
          }
        } finally {
          resetPgpCallbacks()
        }
      }
      ignorePromise(f())
    },
    resetState: () => {
      set(s => ({
        ...s,
        dispatch: {
          ...s.dispatch,
          dynamic: {
            cancelPgpGen: undefined,
            finishedWithKeyGen: undefined,
          },
        },
      }))
    },
  }

  return {
    dispatch,
  }
})
