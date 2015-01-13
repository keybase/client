
rpc = require 'framed-msgpack-rpc'
assert = require 'assert'

path = "/tmp/keybase-#{process.env.USER}/keybased.sock"

x = rpc.createTransport { path }
await x.connect defer err
if err
  console.log "error connecting"
else
  c = new rpc.Client x, "keybase.1"
  await c.invoke 'mykey.keyGenDefault', [{ pushPublic : true }], defer err, response
  if err?
    console.log "Err: #{JSON.stringify err}"
  if response?
    console.log response
  x.close()
process.exit 0
