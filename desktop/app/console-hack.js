import util from 'util'
import {isDev} from '../../react-native/react/local-debug'

export default () => {
  if (!isDev) {
    return
  }

  // override console logging to also go to stdout
  const methods = ['log', 'error', 'info']
  const output = {
    error: process.stderr
  }
  const oldConsole = {}

  methods.forEach(k => {
    if (!oldConsole.hasOwnProperty(k)) {
      oldConsole[k] = console[k]
      console[k] = (...args) => {
        oldConsole[k].apply(console, args)
        if (args.length) {
          const out = output[k] || process.stdout
          out.write(k + ': ' + util.format.apply(util, args))
        }
      }
    }
  })
}
