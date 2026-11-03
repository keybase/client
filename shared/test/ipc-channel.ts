import {setImmediate} from 'node:timers'

// Electron IPC as the test engines model it: each message arrives a macrotask after it was sent, in
// the order it was sent. One channel is one queue; deliverAll() hands over whatever is still on its
// way, and clear() drops it.
export class IpcChannel {
  private _inTransit = new Array<() => void>()
  send(deliver: () => void) {
    this._inTransit.push(deliver)
    setImmediate(() => this._inTransit.shift()?.())
  }
  deliverAll() {
    while (this._inTransit.length) {
      this._inTransit.shift()?.()
    }
  }
  clear() {
    this._inTransit.length = 0
  }
}
