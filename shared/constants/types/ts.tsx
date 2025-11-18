export type Unpacked<T> = T extends (infer U)[]
  ? U
  : T extends (...args: unknown[]) => infer U
    ? U
    : T extends Promise<infer U>
      ? U
      : T

// opaque types
type OpaqueType<T> = {
  _t: T
}
export type Opaque<T, Type> = T & OpaqueType<Type>
