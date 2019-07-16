// A utility to convert our log sends to something consumable by chrome://tracing
import fs from 'fs'
import moment from 'moment'

type Args = {
  counter?: string
  file?: string
  line?: string
}

type Info = {
  app: string
  args: Args
  id: string
  line: string
  name: string
  time: string
  type: string
}

type Event = {
  args: Args
  id: string
  name: string
  ph: string
  pid: number
  tid: string
  ts: number
}

const [, , guiOrCore, logfile, outfile, ..._swimlanes] = process.argv
// Good params?
if (['gui', 'core'].indexOf(guiOrCore) === -1 || !logfile || !outfile) {
  console.log('Usage: node log-to-trace (gui|core) logfile outfile [filter1] [filter2]')
  process.exit(1)
}

const swimlanesReg = (_swimlanes || []).map(swim => new RegExp(swim))
const isGUI = guiOrCore === 'gui'

// core regs
const reg = /([^ ]+) ▶ \[DEBU (keybase|kbfs) ([^:]+):(\d+)] ([0-9a-f]+) ([^[]+)(.*)?/
const tagsReg = /\[tags:([^\]]+)]/
const methodPrefixReg = /^(\+\+Chat: )?/
const methodResultReg = / -> .*$/
const typeAndMethodReg = /^(gui|[+\-|])/
// gui regs
const guiCountTypeTimeReg = /\["(Info|Warn|Action)","([^"]+)","(.*)"]/
const actionReg = /type: ([^ ]+) (.*)/
const actionPayloadReg = /\\"/g

const getSwimlane = (line: string) => {
  const matched = swimlanesReg.find(s => s.exec(line) && !!s.toString())
  return matched && matched.toString()
}

// Handle a single line from a gui log
const convertGuiLine = (line: string): Info | undefined => {
  const e = guiCountTypeTimeReg.exec(line)
  if (!e) {
    console.log('🛑 Skipping unparsed line:', line)
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
            console.log('🛑 throw e', e)
          }
        } else {
          console.log('🛑 Unparsed action!', line, _data)
          name = 'Unparsed action'
        }
      }
      break
    default:
      console.log('🛑 Unknown inner type', type)
      return
  }
  const app = getSwimlane(line) || ''

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

// Handle a single line from a core log
const convertCoreLine = (line: string): Info | undefined => {
  const e = reg.exec(line)
  if (!e) {
    console.log('🛑 Skipping unparsed line:', line)
    return
  }
  const [, time, _app, file, fileline, counter, _typeAndMethod, _tags] = e
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
  const app = getSwimlane(line) || _app || ''

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

const output: {
  collision: Array<Info>
  good: Array<Event>
  single: Array<Event>
  unmatched: Array<Info>
} = {
  // injecting a start and overwriting an unmatched one
  collision: [],
  // valid start-end
  good: [],
  // treat unmatched/collision as a one shot event
  single: [],
  // an end w/o a start
  unmatched: [],
}

const buildEvent = (info: Info, ph: 'B' | 'E' | 'i'): Event => ({
  args: info.args,
  id: info.id,
  name: info.name,
  ph,
  pid: 0,
  tid: info.app,
  ts: moment(info.time).valueOf() * (isGUI ? 1 : 1000),
})

const buildGood = (old: Info, info: Info) => {
  const s = buildEvent(old, 'B')
  const e = buildEvent(info, 'E')
  if (s.ts > e.ts) {
    console.log('🛑 no time travelers allowed')
    return []
  }
  return [s, e]
}

const convertLine = isGUI ? convertGuiLine : convertCoreLine
let lines = fs.readFileSync(logfile, 'utf8').split('\n')
// to help debug a single line just override it here
// lines = [
// 'Line to debug',
// ]
let lastGuiLine: Info | null = null
const knownIDs = {}
lines.forEach(line => {
  const info = convertLine(line)
  if (!info) return

  // console.log(`DEBUG line type: '${info.type}' \n${line}\n${JSON.stringify(info, null, 2)}`)
  // Core has start/end marked with +/-. Ui doesn't have any timing like this so we treat them like they're contiguous
  switch (info.type) {
    case '+':
      // If we overwrite an event, bookkeep that
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
        // If we didn't find a corresponding event, bookkeep that
        output.single = output.single.concat(buildEvent(info, 'i'))
        output.unmatched.push(info)
      }
      break
    case '|':
      // We ignore pipes
      break
    case 'gui':
      // treat all these single fires as a span of time w/ the last item
      if (lastGuiLine) {
        output.good = output.good.concat(buildGood(lastGuiLine, {...info, id: lastGuiLine.id}))
      }
      lastGuiLine = info
      break
    default:
    // Kinda noisy, off for now
    // console.log(`🛑 Unknown line type: '${info.type}' \n${line}\n${JSON.stringify(info, null, 2)}`)
    // console.log(`🛑 Unknown line type: '${info.type}' ${line}`)
  }
})

// Some of these are intended and others are due to parsing errors (etc)
if (output.unmatched.length) {
  console.log('🛑 Unmatched lines:')
  output.unmatched.forEach(u => console.log(u.line))
}

if (output.collision.length) {
  console.log('🛑 Lines with collisions:')
  output.collision.forEach(c => console.log(c.line))
}

const format = {
  displaytimeUnit: 'ms',
  traceEvents: [...output.good, ...output.single],
}
const out = JSON.stringify(format, null, 2)
fs.writeFileSync(outfile, out, 'utf8')
