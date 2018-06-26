// @flow
import net from 'net'
import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import {isWindows, socketPath} from '../constants/platform.desktop'
import logger from '../logger'
import {execFile} from 'child_process'
import path from 'path'
import type {createClientType, incomingRPCCallbackType, connectDisconnectCB} from './index.platform'

class NativeTransport extends TransportShared {
  constructor(incomingRPCCallback, connectCallback, disconnectCallback) {
    console.log('Transport using', socketPath)
    super({path: socketPath}, connectCallback, disconnectCallback, incomingRPCCallback)
    this.needsConnect = true
  }

  _connect_critical_section(cb: any) {
    // eslint-disable-line camelcase
    // $FlowIssue
    super._connect_critical_section(cb)
    windowsHack()
  }
}

function windowsHack() {
  // This net.connect() is a heinous hack.
  //
  // On Windows, but *only* in the renderer thread, our RPC connection
  // hangs until other random net module operations, at which point it
  // unblocks.  Could be Electron, could be a node-framed-msgpack-rpc
  // bug, who knows.
  // $FlowIssue doens't know about process.type
  if (!isWindows || process.type !== 'renderer') {
    return
  }

  var fake = net.connect({})
  // net.connect({}) throws; we don't need to see the error, but we
  // do need it not to raise up to the main thread.
  fake.on('error', function() {})
}

function checkRPCOwnership(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isWindows) {
      return resolve()
    }
    logger.info('Checking RPC ownership')

    const localAppData = String(process.env.LOCALAPPDATA)
    var binPath = localAppData ? path.resolve(localAppData, 'Keybase', 'keybase.exe') : 'keybase.exe'
    const args = ['pipeowner', socketPath]
    execFile(binPath, args, {windowsHide: true}, (error, stdout, stderr) => {
      if (error) {
        logger.info(`pipeowner check result: ${stdout.toString()}`)
        // error will be logged in bootstrap check
        reject(error)
        return
      }
      const result = JSON.parse(stdout.toString())
      if (result.isOwner) {
        resolve()
        return
      }
      logger.info(`pipeowner check result: ${stdout.toString()}`)
      reject(new Error(`pipeowner check failed`))
    })
  })
}

function createClient(
  incomingRPCCallback: incomingRPCCallbackType,
  connectCallback: connectDisconnectCB,
  disconnectCallback: connectDisconnectCB
) {
  return sharedCreateClient(new NativeTransport(incomingRPCCallback, connectCallback, disconnectCallback))
}

function resetClient(client: createClientType) {
  client.transport.reset()
}

export {resetClient, createClient, rpcLog, checkRPCOwnership}
