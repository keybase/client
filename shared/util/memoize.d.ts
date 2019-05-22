export declare function memoizeShallow<F, A1>(func: F, equalityCheck?: (a: A1, b: A1) => boolean): F

export declare function memoize<A, B, C, D, R>(
  func: (a: A, b: B, c: C, d: D) => R,
  equalityCheck?: (newArgs: [A, B, C, D], lastArgs: [A, B, C, D]) => boolean
): (a: A, b: B, c: C, d: D) => R
