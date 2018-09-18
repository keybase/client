
{json} = require 'random-json'
{pack} = require 'purepack'

v = []
d = {}
while v.length < 100
  await json defer j
  s = pack(j).toString('base64')
  unless d[s]
    v.push s
    d[s] = true

console.log "package safedecode"
console.log "var randomJSON = []string{"
for e in v
  console.log '"' + e + '",'
console.log "}"