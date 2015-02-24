
rpc = require 'framed-msgpack-rpc'
assert = require 'assert'

x = rpc.createTransport { host: '127.0.0.1', port : 8022 }
await x.connect defer err
if err
  console.log "error connecting"
else
    c = new rpc.Client x, "test.1"
    await c.invoke 'arith.add', { A : 5, B : 4}, defer err, response
    if err? then console.log "error in RPC: #{err}"
    else assert.equal 9, response
    await c.invoke "arith.divMod", { A : 122 , B : 7}, defer err, res
    if err? then console.log "unexpected error in RPC: #{err}"
    else assert.deepEqual res, { Q : 17, R : 3 }
    await c.invoke 'arith.Broken', {}, defer err, res
    assert.ok err?
    console.log "error back as planned: #{err.toString()}"
    x.close()
process.exit 0
