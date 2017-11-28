// @flow

function toStringForLog(a: any): string {
  if (typeof a === 'string') {
    return a
  } else if (a instanceof Error) {
    return a.toString()
  } else if (typeof a === 'object') {
    return JSON.stringify(a)
  }
  return (a.toString && a.toString()) || 'Failed to turn item to string in toStringForLog'
}

export {toStringForLog}
