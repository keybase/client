// This net.connect() is a heinous hack.
//
// On Windows, but *only* in the renderer thread, our RPC connection
// hangs until other random net module operations, at which point it
// unblocks.  Could be Electron, could be a node-framed-msgpack-rpc
// bug, who knows.

export default function windowsHack () {
  if (process.platform === 'win32') {
    net.connect({})
  }
}
