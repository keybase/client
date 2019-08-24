// Add pluralization rules as necessary
export function pluralize(str: string, count?: number): string {
  return count === 1 ? str : str.endsWith('s') ? str : `${str}s`
}

// Returns a RegExp that matches any string with the given filter
// string (with special characters removed) as a subsequence.
export function makeInsertMatcher(filter: string): RegExp {
  // Clear RegExp special characters: see
  // https://stackoverflow.com/a/9310752 .
  return new RegExp(
    `${filter
      .replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '')
      .split('')
      .map(c => `${c}.*?`)
      .join('')}`,
    'i'
  )
}

export function toStringForLog(a: any): string {
  switch (typeof a) {
    case 'undefined':
      return 'undefined'

    case 'string':
      return a

    case 'object':
      // Includes null.
      if (a instanceof Error) {
        return a.stack || ''
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
