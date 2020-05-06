import * as React from 'react'
import {TypedActions} from '../actions/typed-actions-gen'
import {registerHookMiddleware} from '../store/configure-store'

type CBType = (act: TypedActions) => void
/** A hook to listen to redux actions.  setResult is only called if you're still mounted
  @param watcher: A function which is called when an action is fired
 */
function useWatchActions(watcher: CBType) {
  const isMounted = React.useRef<Boolean>(true)
  const savedHandler = React.useRef<CBType>(watcher)

  React.useEffect(() => {
    savedHandler.current = watcher
  }, [watcher])

  React.useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  React.useEffect(() => {
    const unregister = registerHookMiddleware(a => {
      if (isMounted.current) {
        savedHandler.current(a)
      }
    })
    return () => {
      unregister()
    }
  }, [])
}

export default useWatchActions
