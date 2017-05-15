// @flow

// Like join, but doesn't convert to string at the end
export function intersperse(separator: any, arr: Array<any>): Array<any> {
  return intersperseFn(() => separator, arr)
}

// Like intersperse but takes a function to define the separator
export function intersperseFn(
  separatorFn: (index: number, x: any, a: Array<any>) => any,
  arr: Array<any>
): Array<any> {
  if (arr.length === 0) {
    return []
  }

  return arr.slice(1).reduce((acc, x, i, a) => {
    return acc.concat([separatorFn(i, x, a), x])
  }, [arr[0]])
}

// $FlowIssue can't understand this
export function filterNull<X>(arr: Array<?X>): Array<X> {
  return arr.filter(i => !!i)
}
