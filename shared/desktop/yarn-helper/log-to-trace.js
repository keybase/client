// @flow
const fs = require('fs')
const data = fs.readFileSync(process.argv[2], 'utf8')
const lines = data.split('\n')
const reg = /([^ ]+) ▶ \[DEBU (?:keybase|kbfs) ([^:]+):(\d+)] ([0-9a-f]+) ([^[]+)(\[tags:([^\]]+)])?/
const tagsReg = /\[tags:([^\]]+)]/
const methodPrefixReg = /^(\+\+Chat: )?/
const methodResultReg = / -> .*$/
const typeAndMethodReg = /^(\W*)/

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
        console.log('COLLISION: ', '\n', info, '\n', data[dataKey])
      }
      console.log('INJECT!', dataKey)
      data[dataKey] = info
      break
    case '-':
      if (data[dataKey]) {
        console.log('FOUND!', dataKey)
        data[dataKey] = undefined
      } else {
        console.log('Unmatched -:', info)
      }
      break
    default:
    // TODO put back
    // console.log('Unknown line type:', info.type, ':', line)
  }
})
