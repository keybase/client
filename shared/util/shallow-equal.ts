const hasOwnProperty = Object.prototype.hasOwnProperty

const shallowEqual = (objA: any, objB: any): boolean => {
  if (objA === objB) {
    return true
  }

  if (typeof objA !== 'object' || !objA || typeof objB !== 'object' || !objB) {
    return false
  }

  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)

  if (keysA.length !== keysB.length) {
    return false
  }

  const bHasOwnProperty = hasOwnProperty.bind(objB) as (key: string) => boolean

  for (let idx = 0; idx < keysA.length; idx++) {
    const key = keysA[idx]!

    if (!bHasOwnProperty(key)) {
      return false
    }

    const valueA = objA[key]
    const valueB = objB[key]

    if (valueA !== valueB) {
      return false
    }
  }

  return true
}

export default shallowEqual
