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

  for (const key of keysA) {

    if (!Object.prototype.hasOwnProperty.call(recordB, key)) {
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
