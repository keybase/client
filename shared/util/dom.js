// @flow

export function findDOMNode (start: any, match: string) : any {
  let current = start
  const max = 1000
  let index = 0
  while (current && current.matches) {
    if (current.matches(match)) {
      return current
    }
    current = current.parentNode
    if (++index >= max) throw new Error('Error looping while trying to find in DOM')
  }

  return null
}
