// @flow

export function findDOMNode(start: any, match: string, max: number = 1000): any {
  let current = start
  let index = 0
  while (current && current.matches) {
    if (current.matches(match)) {
      return current
    }
    current = current.parentNode
    if (++index >= max) throw new Error('Hit max loop count while trying to find in DOM')
  }

  return null
}
