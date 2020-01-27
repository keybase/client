export function intersect<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set(a.size > b.size ? [...b].filter(x => a.has(x)) : [...a].filter(x => b.has(x)))
}
export function union<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a, ...b])
}
