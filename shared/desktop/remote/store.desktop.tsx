// This is a helper for remote windows.
// This acts as a fake store for remote windows
// On the main window we plumb through our props and we 'mirror' the props using this helper
// We start up and send an action to the main window which then sends us 'props'
import {createStore, applyMiddleware, Store} from 'redux'
import {TypedActions} from '../../actions/typed-actions-gen'
import * as ConfigGen from '../../actions/config-gen'

const updateStore = 'remoteStore:update'
// Special action that's not sent
type UpdateStoreAction = {
  type: typeof updateStore
  payload: {
    propsStr: string
  }
}

class RemoteStore {
  private store: Store<any, any>
  private gotPropsCallback: (() => void) | null = null // let component know it loaded once so it can show itself. Set to null after calling once
  private deserialize: (arg0: any, arg1: any) => any

  getStore = () => this.store

  private onPropsUpdated = propsStr => {
    // setTimeout since this can be a side effect of the reducer which redux doesn't like
    setTimeout(() => {
      this.store.dispatch({
        payload: {propsStr},
        type: updateStore,
      })
    }, 0)

    if (this.gotPropsCallback) {
      this.gotPropsCallback()
      this.gotPropsCallback = null
    }
  }

  private registerForRemoteUpdate = () => {
    KB.handleRemoteWindowProps(this.onPropsUpdated)
  }

  private reducer = (state: any, action: any) => {
    switch (action.type) {
      case updateStore: {
        return this.deserialize(state, JSON.parse(action.payload.propsStr))
      }
    }

    return state
  }

  constructor(props: {
    windowComponent: string
    windowParam: string
    gotPropsCallback: () => void
    deserialize: (arg0: any, arg1: any) => any
  }) {
    this.store = createStore(
      this.reducer,
      props.deserialize(undefined, undefined),
      applyMiddleware(sendToRemoteMiddleware as any)
    )
    this.deserialize = props.deserialize
    this.gotPropsCallback = props.gotPropsCallback
    this.registerForRemoteUpdate()

    if (__DEV__ && KB.DEV) {
      KB.DEV.DEBUGStore = this.store
    }

    // Search for the main window and ask it directly for our props
    KB.anyToMainDispatchAction(
      ConfigGen.createRemoteWindowWantsProps({
        component: props.windowComponent,
        param: props.windowParam,
      })
    )
  }
}

const sendToRemoteMiddleware = () => (next: (action: TypedActions | UpdateStoreAction) => void) => (
  action: TypedActions | UpdateStoreAction
) => {
  if (action.constructor === Function) {
    throw new Error('pure actions only allowed in remote store2')
  } else if (action.type === updateStore) {
    // Don't forward our internal updateStore call
    return next(action)
  } else {
    KB.anyToMainDispatchAction(action)
  }
  return next(action)
}

export default RemoteStore
