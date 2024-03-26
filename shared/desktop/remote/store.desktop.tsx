// This is a helper for remote windows.
// This acts as a fake store for remote windows
// On the main window we plumb through our props and we 'mirror' the props using this helper
// We start up and send an action to the main window which then sends us 'props'
import * as R from '@/constants/remote'
import * as RemoteGen from '@/actions/remote-gen'
import KB2 from '@/util/electron.desktop'

const {ipcRendererOn} = KB2.functions

class RemoteStore<DeserializeProps, SerializeProps> {
  _value: DeserializeProps
  _gotPropsCallback: (() => void) | undefined // let component know it loaded once so it can show itself. Set to null after calling once
  _deserialize: (state?: DeserializeProps, props?: Partial<SerializeProps>) => DeserializeProps
  _onUpdated: (a: DeserializeProps) => void

  _registerForRemoteUpdate = () => {
    ipcRendererOn?.('KBprops', (_event: unknown, action: unknown) => {
      const old = this._value
      this._value = this._deserialize(old, JSON.parse(action as string) as Partial<SerializeProps>)
      if (this._gotPropsCallback) {
        this._gotPropsCallback()
        this._gotPropsCallback = undefined
      }
      this._onUpdated(this._value)
    })
  }

  constructor(props: {
    windowComponent: string
    windowParam: string
    gotPropsCallback: () => void
    deserialize: (state?: DeserializeProps, props?: Partial<SerializeProps>) => DeserializeProps
    onUpdated: (v: DeserializeProps) => void
  }) {
    this._onUpdated = props.onUpdated
    this._value = props.deserialize(undefined, undefined)
    this._deserialize = props.deserialize
    this._gotPropsCallback = props.gotPropsCallback
    this._registerForRemoteUpdate()

    // Search for the main window and ask it directly for our props
    R.remoteDispatch(
      RemoteGen.createRemoteWindowWantsProps({
        component: props.windowComponent,
        param: props.windowParam,
      })
    )
  }
}

export default RemoteStore
