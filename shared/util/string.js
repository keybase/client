// @flow

// Add pluralization rules as necessary
function pluralize(str: string): string {
  return str.endsWith('s') ? str : `${str}s`
}

function toStringForLog(a: any): string {
  if (typeof a === 'undefined') {
    return 'undefined'
  } else if (typeof a === 'string') {
    return a
  } else if (a instanceof Error) {
    return a.stack
  } else if (typeof a === 'object') {
    return JSON.stringify(a)
  }
  return (a && a.toString && a.toString()) || 'Failed to turn item to string in toStringForLog'
}

export {pluralize, toStringForLog}
