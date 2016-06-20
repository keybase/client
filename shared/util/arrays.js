/* @flow */

// Like join, but doesn't convert to string at the end
export function intersperse (separator: any, arr: Array<any>): Array<any> {
  return intersperseFn(() => separator, arr)
}

// Like intersperse but takes a function to define the separator
export function intersperseFn (separatorFn: (index: number, x: any) => any, arr: Array<any>): Array<any> {
  if (arr.length === 0) {
    return []
  }

  return arr.slice(1).reduce((acc, x, i) => {
    return acc.concat([separatorFn(i, x), x])
  }, [arr[0]])
}

export function filterNull<X> (arr: Array<?X>): Array<X> {
  // $FlowIssue can't understand this
  return arr.filter(i => !!i)
}
