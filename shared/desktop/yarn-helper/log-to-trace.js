// @flow
const fs = require('fs')
const data = fs.readFileSync(process.argv[2], 'utf8')
const moment = require('moment')
const lines = data.split('\n')
const reg = /([^ ]+) ▶ \[DEBU (keybase|kbfs) ([^:]+):(\d+)] ([0-9a-f]+) ([^[]+)(\[tags:([^\]]+)])?/
const tagsReg = /\[tags:([^\]]+)]/
const methodPrefixReg = /^(\+\+Chat: )?/
const methodResultReg = / -> .*$/
const typeAndMethodReg = /^(\W*)/

if (process.argv.length !== 4) {
  console.log('Usage: node log-to-trace logfile outfile')
  process.exit(1)
}

const convertLine = line => {
  const e = reg.exec(line)
  if (!e) {
    console.log('Skipping unparsed line:', line)
    return
  }
  const [, time, coreOrKbfs, file, fileline, counter, _typeAndMethod, _tags] = e
  let tags = 'NO_TAG'
  if (_tags) {
    const match = tagsReg.exec(_tags)
    if (match && match[1]) {
      tags = match[1]
        .split(',')
        .sort()
        .join(',')
    }
  }

  const typeAndMethod = _typeAndMethod
    .replace(methodResultReg, '')
    .replace(methodPrefixReg, '')
    .trim()

  let type = ''
  const _type = typeAndMethodReg.exec(typeAndMethod)
  if (_type && _type[1]) {
    type = _type[1].trim()
  }

  const method = typeAndMethod.replace(typeAndMethodReg, '').trim()
  return {
    coreOrKbfs,
    counter,
    file,
    fileline,
    line,
    method,
    tags,
    time,
    type,
  }
}

const tags = {}
const output = {
  // injecting a start and overwriting an unmatched one
  collision: [],
  // valid start-end
  good: [],
  // treat unmatched/collision as a one shot event
  single: [],
  // an end w/o a start
  unmatched: [],
}

const buildEvent = (info, ph) => ({
  args: {
    counter: info.counter,
    file: info.file,
    line: info.fileline,
  },
  id: `${info.tags}:${info.method}`,
  name: info.method,
  ph,
  pid: 0,
  tid: info.coreOrKbfs,
  ts: moment(info.time).valueOf() * 1000,
})

const buildGood = (old, info) => {
  const s = buildEvent(old, 'B')
  const e = buildEvent(info, 'E')
  if (s.ts > e.ts) {
    console.log('no time travelers allowed')
    return []
  }
  return [s, e]
}

lines.forEach(line => {
  const info = convertLine(line)
  if (!info) return

  // ensure good
  if (!tags[info.tags]) {
    tags[info.tags] = {}
  }

  const data = tags[info.tags]
  const dataKey = info.method

  switch (info.type) {
    case '+':
      if (data[dataKey]) {
        output.single = output.single.concat(buildEvent(data[dataKey], 'i'))
        output.collision.push(info)
      }
      data[dataKey] = info
      break
    case '-':
      if (data[dataKey]) {
        output.good = output.good.concat(buildGood(data[dataKey], info))
        data[dataKey] = undefined
      } else {
        output.single = output.single.concat(buildEvent(info, 'i'))
        output.unmatched.push(info)
      }
      break
    default:
    // console.log('Unknown line type:', info.type, ':', line)
  }
})

if (output.unmatched.length) {
  console.log('Unmatched lines:')
  output.unmatched.forEach(u => console.log(u.line))
}

if (output.collision.length) {
  console.log('Lines with collisions:')
  output.collision.forEach(c => console.log(c.line))
}

const format = {
  displaytimeUnit: 'ms',
  traceEvents: [...output.good, ...output.single],
}
const out = JSON.stringify(format, null, 2)
fs.writeFileSync(process.argv[3], out, 'utf8')
