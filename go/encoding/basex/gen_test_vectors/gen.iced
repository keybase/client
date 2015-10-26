
{prng} = require 'crypto'
{encoding} = require 'armor58'

output_test_encode_vectors = () ->
  out = {
    empty : "".toString('base64')
  }

  for i in [1...100]
    for j in [0...20]
      b = prng(i)
      out["rand_#{i}_#{j}"] = b.toString('base64')

  for i in [1...30]
    for j in [0..i]
      for k in [0...3]
        b = new Buffer (0 for l in [0...j] )
        b = Buffer.concat [ b, prng(i-j) ]
        out["zero_pad_#{i}_#{j}_#{k}"] = b.toString('base64')
        break if i is j
  output out, "testEncodeVectors1"

output = (out, nm) ->
  console.log ""
  console.log "var #{nm} = map[string]string{"
  for k,v of out
    console.log """\t"#{k}" : "#{v}","""
  console.log "}"

junk_sequence = (prob) ->
  badch = " !@#$%^&&*())_+-={}[]:;'<>?,./~`0"
  (badch[i%badch.length] while (i = prng(1)[0])/256 < prob).join ''

junk_inserter = (prob) -> (s) -> (c + junk_sequence(prob) for c in s).join ''

output_test_decode_vectors = () ->
  out = {}
  for i in [10...100] by 3
    for j in [0...75] by 2
      b = prng(i)
      ji = junk_inserter j / 100
      dec = ji encoding.std_encoding.encode b
      out[b.toString('base64')] = dec
  output out, "testDecodeVectors1"

main = () ->
  console.log "package basex"
  output_test_encode_vectors()
  output_test_decode_vectors()

main()
