// @flow

// Add pluralization rules as necessary
function pluralize(str: string): string {
  return str.endsWith('s') ? str : `${str}s`
}

function toStringForLog(a: any): string {
  switch (typeof a) {
    case 'undefined':
      return 'undefined'

    case 'boolean':
      return a.toString()

    case 'number':
      return a.toString()

    case 'string':
      return a

    case 'function':
      break

    case 'object':
      // Includes null.
      if (a instanceof Error) {
        return a.stack
      }
      return JSON.stringify(a)
  }

  return (a && a.toString && a.toString()) || 'Failed to turn item to string in toStringForLog'
}

export {pluralize, toStringForLog}
