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
  const [, time, file, fileline, counter, plusMinus, method, _tags] = e
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
    plusMinus,
    tags,
    time,
  }
}

const started = {}

lines.forEach(line => {
  const info = convertLine(line)
})
