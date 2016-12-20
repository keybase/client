

{Gets} = require('iced-utils')

gets = (new Gets process.stdin).run()

explode = (s) ->
  buf = new Buffer s, "hex"
  ("0x#{i.toString(16)}" for i in buf).join ", "

console.log "package libkb"
console.log "var LegacyUsernameToUIDLookup = map[string]string {"
loop
  await gets.gets defer err, line
  break unless line?
  [uid,username] = line.split /\s+/
  console.log """\t"#{username.toLowerCase()}" : "#{uid}","""
console.log "}"
