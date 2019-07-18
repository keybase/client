// This HOC wraps a RemoteWindow so it can send props over the wire
// Listens for requests from the main process (which proxies requests from other windows) to kick off an update
// If asked we'll send all props, otherwise we do a shallow compare and send the different ones
import * as React from 'react'
import * as SafeElectron from '../../util/safe-electron.desktop'
import {measureStart, measureStop} from '../../util/user-timings'

// set this to true to see details of the serialization process
const debugSerializer = __DEV__ && false
if (debugSerializer) {
  console.log('\n\n\n\n\n\nDEBUGGING REMOTE SERIALIZER')
}

type Props = {
  clearCacheTrigger: number
  windowParam: string | null
  windowComponent: string
  remoteWindow: SafeElectron.BrowserWindowType | null
}

type Serializer = {[K in string]: (value: any, oldValue: any) => Object | null}

function SyncPropsFactory(serializer: Serializer) {
  return function SyncProps(ComposedComponent: any) {
    class RemoteConnected extends React.PureComponent<Props> {
      _lastProps: any

      _sendProps = () => {
        if (this.props.remoteWindow) {
          try {
            measureStart('remoteProps')
            const props = this._getPropsToSend()
            // Using stringify to go over the wire as the representation it sends over IPC is very verbose and blows up
            // the data a lot
            if (this.props.remoteWindow && Object.keys(props).length) {
              this.props.remoteWindow.emit('props', JSON.stringify(props))
            }
          } catch (e) {
            console.error(e)
          } finally {
            measureStop('remoteProps')
          }
        }
      }

      _onNeedProps = (_, windowComponent: string, windowParam: string) => {
        if (windowComponent === this.props.windowComponent && windowParam === this.props.windowParam) {
          // If the remote asks for props send the whole thing
          this._lastProps = null
          this._sendProps()
        }
      }

      _getPropsToSend = () => {
        const newProps = this._getChildProps()
        const toSend = {}

        // Do a shallow equal
        if (debugSerializer) {
          console.log('[Serializer]: ---------------------------------')
        }
        Object.keys(newProps).forEach(k => {
          // Is different
          if (!this._lastProps || newProps[k] !== this._lastProps[k]) {
            if (serializer[k]) {
              const val = serializer[k](newProps[k], this._lastProps ? this._lastProps[k] : undefined)

              if (debugSerializer) {
                console.log(
                  '[Serializer]: ',
                  k,
                  'old:',
                  this._lastProps && this._lastProps[k],
                  'new: ',
                  newProps[k],
                  ' output: ',
                  val
                )
              }
              if (val !== undefined) {
                toSend[k] = val
              }
            } else {
              throw new Error('[Serializer]: All keys MUST be handled in remote: ' + k)
            }
          }
        })

        this._lastProps = newProps
        return toSend
      }

      _getChildProps = () => {
        // Don't pass down remoteWindow
        const {remoteWindow, ...props} = this.props
        return props
      }

      componentDidMount() {
        SafeElectron.getIpcRenderer().on('remoteWindowWantsProps', this._onNeedProps)
      }
      componentWillUnmount() {
        SafeElectron.getIpcRenderer().removeListener('remoteWindowWantsProps', this._onNeedProps)
      }
      componentDidUpdate(prevProps: Props) {
        if (this.props.clearCacheTrigger !== prevProps.clearCacheTrigger) {
          this._lastProps = null
        }
      }

      render() {
        this._sendProps()
        return <ComposedComponent {...this._getChildProps()} />
      }
    }

    return RemoteConnected
  }
}

export default SyncPropsFactory
