// @flow
const fs = require('fs')
const data = fs.readFileSync(process.argv[2], 'utf8')
const moment = require('moment')
const lines = data.split('\n')
const reg = /([^ ]+) ▶ \[DEBU (?:keybase|kbfs) ([^:]+):(\d+)] ([0-9a-f]+) ([^[]+)(\[tags:([^\]]+)])?/
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
    // TODO put back
    // console.log('Skipping unparsed line:', line)
    return
  }
  const [, time, file, fileline, counter, _typeAndMethod, _tags] = e
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

  // if (tags === 'NO_TAG') {
  // if (line.indexOf('[tag]') !== -1) {
  // console.log('missing tag?', line)
  // }
  // }

  const typeAndMethod = _typeAndMethod
    .replace(methodResultReg, '')
    .replace(methodPrefixReg, '')
    .trim()

  let type = ''
  const _type = typeAndMethodReg.exec(typeAndMethod)
  if (_type && _type[1]) {
    type = _type[1].trim()
  } else {
    // console.log(_type)
  }

  const method = typeAndMethod.replace(typeAndMethodReg, '').trim()
  return {
    counter,
    file,
    fileline,
    line, // TODO remove
    method,
    tags,
    time,
    type,
  }
}

const tags = {}
const output = {
  collision: [],
  good: [],
  unmatched: [],
}

const buildGood = (old, info) => {
  const id = `${info.tags}:${info.method}`
  const startTs = moment(old.time).valueOf() * 1000
  const endTs = moment(info.time).valueOf() * 1000
  if (endTs < startTs) {
    console.log('bad start/end')
    return []
  }
  return [
    {
      args: {
        counter: old.counter,
        file: old.file,
        line: old.fileline,
      },
      id,
      name: old.method,
      ph: 'B',
      pid: 0,
      tid: old.tags,
      ts: startTs,
    },
    {
      args: {
        counter: info.counter,
        file: info.file,
        line: info.fileline,
      },
      id,
      name: info.method,
      ph: 'E',
      pid: 0,
      tid: info.tags,
      ts: endTs,
    },
  ]
}

lines.forEach(line => {
  const info = convertLine(line)
  // console.log(info.type, '**', info.method, '**', info.tags)
  if (!info) return

  // ensure good
  if (!tags[info.tags]) {
    tags[info.tags] = {}
  }

  const data = tags[info.tags]
  const dataKey = info.method
  // const dataKey = `${info.file}:${info.method}`

  // if (info.counter === '06c') {
  // console.log(info)
  // console.log(tags)
  // process.exit()
  // } else {
  // }

  switch (info.type) {
    case '+':
      if (data[dataKey]) {
        output.collision.push(info)
        // console.log('COLLISION: ', '\n', info, '\n', data[dataKey])
      }
      // console.log('INJECT!', dataKey)
      data[dataKey] = info
      break
    case '-':
      if (data[dataKey]) {
        // console.log('FOUND!', dataKey)
        output.good = output.good.concat(buildGood(data[dataKey], info))
        data[dataKey] = undefined
      } else {
        // console.log('Unmatched -:', info)
        output.unmatched.push(info)
      }
      break
    default:
    // TODO put back
    // console.log('Unknown line type:', info.type, ':', line)
  }
})

// if (output.unmatched.length) {
// console.log('Unmatched lines:')
// output.unmatched.forEach(u => console.log(u.line))
// }

// if (output.collision.length) {
// console.log('Lines with collisions:')
// output.collision.forEach(c => console.log(c.line))
// }

const format = {
  displaytimeUnit: 'ms',
  traceEvents: output.good,
}
const out = JSON.stringify(format, null, 2)
fs.writeFileSync(process.argv[3], out, 'utf8')
