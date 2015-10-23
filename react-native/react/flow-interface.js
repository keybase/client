declare module 'invariant' {
  declare var exports: (callback: any) => any;
}

declare module 'Interpolation' {
  declare var exports: (callback: any) => any;
}

// Algebraic data types

declare interface MapADT2<K1, V1, K2, V2> {
  set(key: K1, value: V1 ): MapADT2<K1, V1, K2, V2>;
  set(key: K2, value: V2 ): MapADT2<K1, V1, K2, V2>;
  update(key: K1, updateFn: (v: V1) => V1): MapADT2<K1, V1, K2, V2>;
  update(key: K2, updateFn: (v: V2) => V2): MapADT2<K1, V1, K2, V2>;
  get(key: K1): V1;
  get(key: K2): V2;
  // This is probably hard, okay to bail on it for now
  updateIn(ks: Array<any>, updateFn: (v: any) => any): MapADT2<K1, V1, K2, V2>;
}
