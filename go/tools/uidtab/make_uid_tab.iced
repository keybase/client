
{Gets} = require('iced-utils')
{make_esc} = require 'iced-error'

to_bytes = (s) ->
  b = new Buffer s, "hex"
  ("0x#{i.toString(16)}" for i in b[0...-1]).join ", "


main = (cb) ->
  esc = make_esc cb, "main"
  gets = (new Gets process.stdin).run()
  users = []
  loop
    await gets.gets esc defer line
    break unless line?
    users.push line.split /\s+/

  console.log "package libkb"

  console.log "var legacyUsers = []struct{"
  console.log "\tn string"
  console.log "\tu [15]byte"
  console.log "}{"

  for [uid, username] in users when uid.match /00$/
    console.log """{ "#{username}", [15]byte{ #{to_bytes(uid) } } },"""
  console.log "}"

  cb null


await main defer err
if err?
  console.error err.toString()
  process.exit -2
process.exit 0
