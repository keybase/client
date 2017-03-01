// @flow
import {Iterable} from 'immutable'

// Keeps a ring buffer of things to log
// Can periodically log out the last thing written
// Can dump all logs
const PREFIX_LOG: string = 'PLL:'
const PREFIX_WARN: string = 'PLW:'
const PREFIX_ERROR: string = 'PLE:'
const PREFIX_DUMP_CURRENT: string = 'PLC:'
const PREFIX_DUMP_ALL: string = 'PLA:'

const _loggers: {[name: string]: PeriodicLogger} = {}

class PeriodicLogger {
  _name: string
  _lastWrite: number = -1 // can be larger than array, used as a 'virtual' index so we can bookkeep messages
  _messages: Array<Array<any>> = []
  _size: number
  _logIncoming: boolean
  _logTransform: (Array<any>) => Array<any>
  _logAfterXActions: number

  constructor (name: string, size: number, logIncoming: boolean, logTransform: ?(Array<any> => Array<any>), logAfterXActions: number) {
    if (size <= 0) {
      throw new Error(`PeriodLogger size must be positive: ${size}`)
    }
    this._size = size
    this._name = name
    this._logIncoming = logIncoming
    this._logTransform = logTransform || ((args: Array<any>) => args)
    this._logAfterXActions = logAfterXActions
  }

  _write (args: Array<any>) {
    this._lastWrite++
    this._messages[this._lastWrite % this._size] = args

    if (this._logIncoming) {
      this._dump(PREFIX_DUMP_CURRENT, args)
    } else if (this._logAfterXActions > 0) {
      if ((this._lastWrite % this._logAfterXActions) === 0) {
        this._dump(PREFIX_DUMP_CURRENT, args)
      }
    }
  }

  log (...args: Array<any>) {
    !this._logIncoming && console.log(PREFIX_LOG, this._lastWrite + 1) // output current index so we can see the order of things and correlate a full dump
    this._write(args)
  }

  warn (...args: Array<any>) {
    !this._logIncoming && console.warn(PREFIX_WARN, this._lastWrite + 1)
    this._write(args)
  }

  error (...args: Array<any>) {
    !this._logIncoming && console.error(PREFIX_ERROR, this._lastWrite + 1)
    this._write(args)
  }

  groupEnd () { }
  groupCollapsed () { }
  group () { }
  info () { }

  _dump (prefix: string, args: Array<any>) {
    console.log(prefix, ...this._logTransform(args))
  }

  dumpCurrent () {
    const args = this._lastWrite !== -1 && this._messages[this._lastWrite % this._size]
    if (args) {
      this._dump(`${PREFIX_DUMP_CURRENT}${this._lastWrite}:`, args)
    }
  }

  clear () {
    this._lastWrite = -1
    this._messages = []
  }

  dumpAll () {
    let index = this._lastWrite
    const endIndex = Math.max(0, index - this._size)
    while (index >= endIndex) {
      const args = this._messages[index % this._size]
      if (args) {
        this._dump(`${PREFIX_DUMP_ALL}${index}:`, args)
      } else {
        break
      }

      index--
    }
  }
}

function dumpLoggers () {
  Object.keys(_loggers).forEach(name => {
    _loggers[name].dumpAll()
  })
}

function setupLogger (name: string, size: number, logIncoming: boolean, logTransform: ?(Array<any>) => Array<any>, logAfterXActions: number): PeriodicLogger {
  if (_loggers[name]) {
    throw new Error(`logger already named ${name} exists`)
  }

  _loggers[name] = new PeriodicLogger(name, size, logIncoming, logTransform, logAfterXActions)
  return _loggers[name]
}

function getLogger (name: string) {
  if (!_loggers[name]) {
    throw new Error(`No logger named ${name}`)
  }
  return _loggers[name]
}

// Transform objects from Immutable on printing
type ImmutableToJSType = ?Array<any>

// $FlowIssue this is a generic mechanism where the caller is making sure it'll match. Not clear how to encode that simply
const immutableToJS = ([prefix, state]: ImmutableToJSType) => { // eslint-disable-line
  var newState = {}

  Object.keys(state).forEach(i => {
    if (Iterable.isIterable(state[i])) {
      newState[i] = state[i].toJS()
    } else {
      newState[i] = state[i]
    }
  })

  return [prefix, newState]
}

export {
  dumpLoggers,
  getLogger,
  immutableToJS,
  setupLogger,
}
