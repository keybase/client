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
    sig_ids = []
    loop
      await gets.gets esc defer line
      break unless line?
      [which, hash] = line.split /\s+/
      sig_ids.push [hash, (which is 'h')]
    cb null, sig_ids

  output : ({sig_ids}) ->
    out = []
    out.push "package sigid"
    out.push ''
    @output_test_vectors { out, sig_ids }
    out.join "\n"

  output_test_vectors : ({out, sig_ids}) ->
    out.push "var testVectors = []struct{"
    out.push "\tsigID string"
    out.push "\tisModern bool"
    out.push "}{"
    for [sig_id, isModern] in sig_ids
      out.push """\t{"#{sig_id}",#{isModern}},"""
    out.push "}"

  run : ({input}, cb) ->
    esc = make_esc cb, "run"
    await @read { input }, esc defer sig_ids
    out = @output { sig_ids }
    console.log out
    cb null

r = new Runner
await r.run { input : process.stdin }, defer err
rc = 0
if err?
  console.err err.toString()
  rc = -2
process.exit rc
