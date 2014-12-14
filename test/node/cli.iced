
rpc = require 'framed-msgpack-rpc'
assert = require 'assert'

x = rpc.createTransport { host: '127.0.0.1', port : 8222 }
await x.connect defer err
if err
  console.log "error connecting"
else
  c = new rpc.Client x, "keybase.1"
  await c.invoke 'signup.CheckUsernameAvailable', { username : process.argv[2]}, defer err, response
  if err? then console.log "error in RPC: #{err}"
  else console.log response
  x.close()
process.exit 0
