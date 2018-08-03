// @flow

// Add pluralization rules as necessary
function pluralize(str: string): string {
  return str.endsWith('s') ? str : `${str}s`
}

function toStringForLog(a: any): string {
  switch (typeof a) {
    case 'undefined':
      return 'undefined'

    case 'string':
      return a

    case 'object':
      // Includes null.
      if (a instanceof Error) {
        return a.stack
      }
      return JSON.stringify(a)

    case 'boolean':
    // Fall through.
    case 'number':
    // Fall through.
    case 'function':
    // Fall through.
    default:
      // Symbol (which flow doesn't recognize) or some
      // implementation-defined thing.
      if (a.toString) {
        return a.toString()
      }
      return `Failed to turn item of type ${typeof a} to string in toStringForLog`
  }
}

export {pluralize, toStringForLog}
