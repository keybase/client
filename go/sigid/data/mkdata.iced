{Gets} = require('iced-utils')
{make_esc} = require 'iced-error'

hash_to_uint32 = (h) -> "0x" + h[0...8]

class Runner

  constructor : () ->
    map = []

  read : ({input}, cb) ->
    esc = make_esc cb, "read"
    gets = (new Gets input).run()
    hashes = []
    loop
      await gets.gets esc defer line
      break unless line?
      hashes.push line
    cb null, hashes

  output : ({hashes}, cb) ->
    out = []
    out.push "package sigid"
    out.push ''
    @output_hashes { hashes, out }
    out.join "\n"

  output_hashes : ({hashes, out}) ->
    out.push "var legacyHashPrefixes = [...]uint32{"
    for hash in hashes
      out.push "\t" + hash_to_uint32(hash) + ","
    out.push "}"

  run : ({input}, cb) ->
    esc = make_esc cb, "run"
    await @read { input }, esc defer hashes
    out = @output { hashes }
    console.log out
    cb null

r = new Runner
await r.run { input : process.stdin }, defer err
rc = 0
if err?
  console.err err.toString()
  rc = -2
process.exit rc
