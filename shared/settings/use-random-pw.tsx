import * as React from 'react'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import {RPCError} from '@/util/errors'

const isRandomPassphraseState = (state: T.RPCGen.PassphraseState) => state === T.RPCGen.PassphraseState.random

export const useRandomPWState = () => {
  const [randomPW, setRandomPW] = React.useState<boolean | undefined>(undefined)
  const requestVersionRef = React.useRef(0)

  const reload = React.useCallback(() => {
    const version = requestVersionRef.current + 1
    requestVersionRef.current = version

    const load = async () => {
      try {
        const passphraseState = await T.RPCGen.userLoadPassphraseStateRpcPromise()
        if (requestVersionRef.current !== version) {
          return
        }
        setRandomPW(isRandomPassphraseState(passphraseState))
      } catch (error) {
        if (!(error instanceof RPCError)) {
          return
        }
        if (requestVersionRef.current !== version) {
          return
        }
        logger.warn('Error loading hasRandomPW:', error.message)
      }
    }

    ignorePromise(load())
  }, [])

  React.useEffect(() => {
    reload()
  }, [reload])

  useEngineActionListener('keybase.1.NotifyUsers.passwordChanged', action => {
    requestVersionRef.current += 1
    setRandomPW(isRandomPassphraseState(action.payload.params.state))
  })

  return {
    loaded: randomPW !== undefined,
    randomPW,
    reload,
  }
}
