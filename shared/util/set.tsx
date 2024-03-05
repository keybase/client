export function intersect<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
  return new Set(a.size > b.size ? [...b].filter(x => a.has(x)) : [...a].filter(x => b.has(x)))
}
export function union<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
  return new Set([...a, ...b])
}
