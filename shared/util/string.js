// @flow

// Add pluralization rules as necessary
function pluralize(str: string): string {
  return str.endsWith('s') ? str : `${str}s`
}

function toStringForLog(a: any): string {
  const t = typeof a
  switch (t) {
    case 'undefined':
      return 'undefined'

    case 'boolean':
      return a.toString()

    case 'number':
      return a.toString()

    case 'string':
      return a

    case 'function':
      return a.toString()

    case 'symbol':
      return a.toString()

    case 'object':
      // Includes null.
      if (a instanceof Error) {
        return a.stack
      }
      return JSON.stringify(a)

    default:
      // Symbol (which flow doesn't recognize) or some
      // implementation-defined thing.
      if (a.toString) {
        return a.toString()
      }
      return `Failed to turn item of type ${t} to string in toStringForLog`
  }
}

export {pluralize, toStringForLog}
