{Gets} = require('iced-utils')
{make_esc} = require 'iced-error'

hash_to_uint32 = (h) -> "0x" + h[0...8]
hash_to_3bytes = (h) -> ( "0x#{h[i...(i+2)]}" for i in [0...6] by 2)
hash_to_uint16 = (h) -> "0x" + h[0...4]

# "abcdef1234" => ["abcd", "abcdef", "abcdef12" ]
prefix_split = (h) -> (h[0...i] for i in [4..8] by 2)

class Runner

  constructor : () ->
    map = []

  read : ({input}, cb) ->
    esc = make_esc cb, "read"
    gets = (new Gets input).run()
    h = {} # Sigs that start with 'h' are the new-style signatures (like >= 1.0.17)
    g = [] # Sigs that start with 'g' are the legacy-style signatures (like < 1.0.16)
    loop
      await gets.gets esc defer line
      break unless line?
      [which, hash] = line.split /\s+/
      if which is 'g'
        g.push hash
      else
        for prefix in prefix_split(hash)
          h[prefix] = true
    cb null, {g, h}

  output : ({h, g}) ->
    out = []
    out.push "package sigid"
    out.push ''
    covered = {}
    @output_shorts { out, h, g, covered }
    @output_3bytes { out, h, g, covered }
    @output_words  { out, h, g, covered }
    out.join "\n"

  output_shorts : ({out, h, g, covered}) ->
    out.push "var legacyHashPrefixes16 = [...]uint16{"
    output16 = {}
    for hash in g when not(h[(prfx = hash[0...4])]) and not(covered[hash])
      if not(output16[prfx])
        out.push "\t" + hash_to_uint16(hash) + ","
      covered[hash] = true
      output16[prfx] = true
    out.push "}"

  output_3bytes : ({out, h, g, covered}) ->
    out.push "var legacyHashPrefixes24 = [...]byte{"
    output24 = {}
    for hash in g when not(h[(prfx = hash[0...6])]) and not(covered[hash])
      if not(output24[prfx])
        out.push "\t" + hash_to_3bytes(hash).join(", ") + ","
      covered[hash] = true
      output24[prfx] = true
    out.push "}"

  output_words : ({out, h, g, covered}) ->
    out.push "var legacyHashPrefixes32 = [...]uint32{"
    output32 = {}
    for hash in g when not(h[(prfx = hash[0...8])]) and not(covered[hash])
      if not(output32[prfx])
        out.push "\t" + hash_to_uint32(hash) + ","
      covered[hash] = true
      output32[prfx] = true
    out.push "}"

  run : ({input}, cb) ->
    esc = make_esc cb, "run"
    await @read { input }, esc defer {g,h}
    out = @output { g,h }
    console.log out
    cb null

r = new Runner
await r.run { input : process.stdin }, defer err
rc = 0
if err?
  console.err err.toString()
  rc = -2
process.exit rc
