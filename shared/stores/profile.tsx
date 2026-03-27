import * as T from '@/constants/types'
import {ignorePromise, wrapErrors} from '@/constants/utils'
import * as Z from '@/util/zustand'
import {RPCError} from '@/util/errors'
import {navigateAppend} from '@/constants/router'
import type {useTrackerState} from '@/stores/tracker'

export type ProveGenericParams = {
  logoBlack: T.Tracker.SiteIconSet
  logoFull: T.Tracker.SiteIconSet
  title: string
  subtext: string
  suffix: string
  buttonLabel: string
}

export const makeProveGenericParams = (): ProveGenericParams => ({
  buttonLabel: '',
  logoBlack: [],
  logoFull: [],
  subtext: '',
  suffix: '',
  title: '',
})

export const toProveGenericParams = (p: T.RPCGen.ProveParameters): T.Immutable<ProveGenericParams> => ({
  ...makeProveGenericParams(),
  buttonLabel: p.buttonLabel,
  logoBlack: p.logoBlack || [],
  logoFull: p.logoFull || [],
  subtext: p.subtext,
  suffix: p.suffix,
  title: p.title,
})

type GeneratePgpArgs = {
  pgpEmail1: string
  pgpEmail2: string
  pgpEmail3: string
  pgpFullName: string
}

type Store = T.Immutable<{
}>

const initialStore: Store = {}

export type State = Store & {
  dispatch: {
    defer: {
      onTracker2GetDetails?: (username: string) => T.Tracker.Details | undefined
      onTracker2Load?: (
        params: Parameters<ReturnType<typeof useTrackerState.getState>['dispatch']['load']>[0]
      ) => void
      onTracker2ShowUser?: (username: string, asTracker: boolean, skipNav?: boolean) => void
      onTracker2UpdateResult?: (guiID: string, result: T.Tracker.DetailsState, reason?: string) => void
    }
    dynamic: {
      afterCheckProof?: () => void
      cancelAddProof?: () => void
      cancelPgpGen?: () => void
      finishedWithKeyGen?: (shouldStoreKeyOnServer: boolean) => void
      submitUsername?: (username: string) => void
    }
    editAvatar: () => void
    generatePgp: (args: GeneratePgpArgs) => void
    resetState: () => void
  }
}

export const useProfileState = Z.createZustand<State>('profile', (set, get) => {
  const resetProofCallbacks = () => {
    set(s => {
      s.dispatch.dynamic.afterCheckProof = undefined
      s.dispatch.dynamic.cancelAddProof = defaultCancelAddProof
      s.dispatch.dynamic.submitUsername = undefined
    })
  }
  const defaultCancelAddProof = () => {
    resetProofCallbacks()
  }

  const resetPgpCallbacks = () => {
    set(s => {
      s.dispatch.dynamic.cancelPgpGen = undefined
      s.dispatch.dynamic.finishedWithKeyGen = undefined
    })
  }

  const dispatch: State['dispatch'] = {
    defer: {
      onTracker2GetDetails: () => {
        throw new Error('onTracker2GetDetails not implemented')
      },
      onTracker2Load: () => {
        throw new Error('onTracker2Load not implemented')
      },
      onTracker2ShowUser: () => {
        throw new Error('onTracker2ShowUser not implemented')
      },
      onTracker2UpdateResult: () => {
        throw new Error('onTracker2UpdateResult not implemented')
      },
    },
    dynamic: {
      cancelAddProof: defaultCancelAddProof,
      cancelPgpGen: undefined,
      finishedWithKeyGen: undefined,
      submitUsername: undefined,
    },
    editAvatar: () => {
      throw new Error('This is overloaded by platform specific')
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
        ...initialStore,
        dispatch: {
          ...s.dispatch,
          dynamic: {
            afterCheckProof: undefined,
            cancelAddProof: defaultCancelAddProof,
            cancelPgpGen: undefined,
            finishedWithKeyGen: undefined,
            submitUsername: undefined,
          },
        },
      }))
    },
  }

  return {
    ...initialStore,
    dispatch,
  }
})
