const hasOwnProperty = Object.prototype.hasOwnProperty

const isObjectLike = (value: unknown): value is object => typeof value === 'object' && value !== null

const shallowEqual = (objA: unknown, objB: unknown): boolean => {
  if (objA === objB) {
    return true
  }

  if (!isObjectLike(objA) || !isObjectLike(objB)) {
    return false
  }

  const recordA = objA as Record<string, unknown>
  const recordB = objB as Record<string, unknown>
  const keysA = Object.keys(recordA)
  const keysB = Object.keys(recordB)

  if (keysA.length !== keysB.length) {
    return false
  }

  const bHasOwnProperty = hasOwnProperty.bind(recordB) as (key: string) => boolean

  for (let idx = 0; idx < keysA.length; idx++) {
    const key = keysA[idx]!

    if (!bHasOwnProperty(key)) {
      return false
    }

    const valueA = recordA[key]
    const valueB = recordB[key]

    if (valueA !== valueB) {
      return false
    }
  }

  return true
}

export default shallowEqual
