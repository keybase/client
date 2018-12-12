// @flow
const [, , guiOrCore, logfile, outfile] = process.argv
if (['gui', 'core'].indexOf(guiOrCore) === -1 || !logfile || !outfile) {
  console.log('Usage: node log-to-trace (gui|core) logfile outfile')
  process.exit(1)
}
const isGUI = guiOrCore === 'gui'
const fs = require('fs')
const moment = require('moment')
// core regs
const reg = /([^ ]+) ▶ \[DEBU (keybase|kbfs) ([^:]+):(\d+)] ([0-9a-f]+) ([^[]+)(\[tags:([^\]]+)])?/
const tagsReg = /\[tags:([^\]]+)]/
const methodPrefixReg = /^(\+\+Chat: )?/
const methodResultReg = / -> .*$/
const typeAndMethodReg = /^(\W*)/
// gui regs
const guiCountTypeTimeReg = /\["(Info|Warn|Action)","([^"]+)","(.*)"]/
const actionReg = /type: ([^ ]+) (.*)/
const actionPayloadReg = /\\"/g

const convertGuiLine = line => {
  const e = guiCountTypeTimeReg.exec(line)
  if (!e) {
    console.log('Skipping unparsed line:', line)
    return
  }
  const [, type, time, _data] = e
  let name = ''
  let args = {}
  switch (type) {
    case 'Warn':
      name = `W: ${_data}`
      break
    case 'Info':
      name = `I: ${_data}`
      break
    case 'Action':
      {
        const m = actionReg.exec(_data)
        if (m) {
          const [, actionType, payload] = m
          name = actionType
          try {
            args = JSON.parse(payload.replace(actionPayloadReg, '"'))
          } catch (e) {
            console.log('throw e', e)
          }
        } else {
          console.log('Unparsed action!', line, _data)
          name = 'Unparsed action'
        }
      }
      break
    default:
      console.log('Unknown inner type', type)
      return
  }
  const app = 'gui'

  return {
    app,
    args,
    id: name,
    line,
    name,
    time,
    type: 'gui',
  }
}

const convertCoreLine = line => {
  const e = reg.exec(line)
  if (!e) {
    console.log('Skipping unparsed line:', line)
    return
  }
  const [, time, app, file, fileline, counter, _typeAndMethod, _tags] = e
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
  const args = {
    counter: counter,
    file: file,
    line: fileline,
  }
  const id = `${tags}:${method}`
  const name = method
  return {
    app,
    args,
    id,
    line,
    name,
    time,
    type,
  }
}

const convertLine = isGUI ? convertGuiLine : convertCoreLine

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
  args: info.args,
  id: info.id,
  name: info.name,
  ph,
  pid: 0,
  tid: info.app,
  ts: moment(info.time).valueOf() * (isGUI ? 1 : 1000),
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

const lines = fs.readFileSync(logfile, 'utf8').split('\n')
let lastGuiLine = null
const knownIDs = {}
lines.forEach(line => {
  const info = convertLine(line)
  if (!info) return

  switch (info.type) {
    case '+':
      if (knownIDs[info.id]) {
        output.single = output.single.concat(buildEvent(knownIDs[info.id], 'i'))
        output.collision.push(info)
      }
      knownIDs[info.id] = info
      break
    case '-':
      if (knownIDs[info.id]) {
        output.good = output.good.concat(buildGood(knownIDs[info.id], info))
        knownIDs[info.id] = undefined
      } else {
        output.single = output.single.concat(buildEvent(info, 'i'))
        output.unmatched.push(info)
      }
      break
    case 'gui':
      // treat all these single fires as a span of time w/ the last item
      if (lastGuiLine) {
        output.good = output.good.concat(buildGood(lastGuiLine, {...info, id: lastGuiLine.id}))
      }
      lastGuiLine = info
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
fs.writeFileSync(outfile, out, 'utf8')
