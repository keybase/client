// @flow
const fs = require('fs')
const data = fs.readFileSync(process.argv[2], 'utf8')
const lines = data.split('\n')
const reg = /([^ ]+) ▶ \[DEBU keybase ([^:]+):(\d+)] ([0-9a-f]+) ([+-|])([^[]+)(\[tags:([^\]]+)])?/
const tagsReg = /\[tags:([^\]]+)]/

const convertLine = line => {
  const e = reg.exec(line)
  if (!e) {
    console.log('Skipping unparsed line:', line)
    return
  }
  const [, time, file, fileline, counter, type, method, _tags] = e
  let tags = _tags && tagsReg.exec(_tags)
  tags =
    tags &&
    tags[1]
      .split(',')
      .sort()
      .join(',')
  return {
    counter,
    file,
    fileline,
    method,
    tags,
    time,
    type,
  }
}

const started = {}

lines.forEach(line => {
  const info = convertLine(line)
  if (!info) return

  switch (info.type) {
    case '+':
      console.log('START', info.method)
      break
    case '-':
      console.log('END', info.method)
      break
    default:
      console.log('Unknown line type:', info.type, ':', line)
  }
})
