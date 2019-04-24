// @flow

// Like intersperse but takes a function to define the separator
export function intersperseFn<A, B>(
  separatorFn: (index: number, x: A, a: Array<A>) => B,
  arr: Array<A>
): Array<A | B> {
  if (arr.length === 0) {
    // $FlowIssue an array with no length is a valid type for any Array
    return arr
  }

  let toReturn = [arr[0]]
  for (let i = 1; i < arr.length; i++) {
    toReturn.push(separatorFn(i, arr[i], arr), arr[i])
  }
  return toReturn
}
