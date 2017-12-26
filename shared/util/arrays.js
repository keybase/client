// @flow

// Like intersperse but takes a function to define the separator
export function intersperseFn(
  separatorFn: (index: number, x: any, a: Array<any>) => any,
  arr: Array<any>
): Array<any> {
  if (arr.length === 0) {
    return []
  }

  return arr.slice(1).reduce(
    (acc, x, i, a) => {
      return acc.concat([separatorFn(i, x, a), x])
    },
    [arr[0]]
  )
}
