declare module 'invariant' {
  declare var exports: (callback: any) => any;
}

declare module 'Interpolation' {
  declare var exports: any;
}

declare module 'electron' {
  declare var exports: any;
}

declare module 'redux-devtools' {
  declare var exports: any;
}

declare module 'marked' {
  declare var exports: any;
}

declare module 'material-ui' {
  declare var exports: any;
}

declare module 'material-ui/lib/svg-icons/navigation/close' {
  declare var exports: any;
}

declare class Notification {
}

declare module 'resolveAssets' {
  declare var exports: (s: string) => string;
}

// Algebraic data types
// This is a bit hacky, but it gives you strong gaurantees.

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

declare interface MapADT3<K1, V1, K2, V2, K3, V3> {
  set(key: K1, value: V1 ): MapADT3<K1, V1, K2, V2, K3, V3>;
  set(key: K2, value: V2 ): MapADT3<K1, V1, K2, V2, K3, V3>;
  set(key: K3, value: V3 ): MapADT3<K1, V1, K2, V2, K3, V3>;
  update(key: K1, updateFn: (v: V1) => V1): MapADT3<K1, V1, K2, V2, K3, V3>;
  update(key: K2, updateFn: (v: V2) => V2): MapADT3<K1, V1, K2, V2, K3, V3>;
  update(key: K3, updateFn: (v: V3) => V3): MapADT3<K1, V1, K2, V2, K3, V3>;
  get(key: K1): V1;
  get(key: K2): V2;
  get(key: K3): V3;
  // This is probably hard, okay to bail on it for now
  updateIn(ks: Array<any>, updateFn: (v: any) => any): MapADT3<K1, V1, K2, V2, K3, V3>;
}

declare interface MapADT4<K1, V1, K2, V2, K3, V3, K4, V4> {
  set(key: K1, value: V1 ): MapADT4<K1, V1, K2, V2, K3, V3, K4, V4>;
  set(key: K2, value: V2 ): MapADT4<K1, V1, K2, V2, K3, V3, K4, V4>;
  set(key: K3, value: V3 ): MapADT4<K1, V1, K2, V2, K3, V3, K4, V4>;
  set(key: K4, value: V4 ): MapADT4<K1, V1, K2, V2, K3, V3, K4, V4>;
  update(key: K1, updateFn: (v: V1) => V1): MapADT4<K1, V1, K2, V2, K3, V3, K4, V4>;
  update(key: K2, updateFn: (v: V2) => V2): MapADT4<K1, V1, K2, V2, K3, V3, K4, V4>;
  update(key: K3, updateFn: (v: V3) => V3): MapADT4<K1, V1, K2, V2, K3, V3, K4, V4>;
  update(key: K4, updateFn: (v: V4) => V4): MapADT4<K1, V1, K2, V2, K3, V3, K4, V4>;
  get(key: K1): V1;
  get(key: K2): V2;
  get(key: K3): V3;
  get(key: K4): V4;
  // This is probably hard, okay to bail on it for now
  updateIn(ks: Array<any>, updateFn: (v: any) => any): MapADT4<K1, V1, K2, V2, K3, V3, K4, V4>;
}

declare interface MapADT5<K1, V1, K2, V2, K3, V3, K4, V4, K5, V5> {
  set(key: K1, value: V1 ): MapADT5<K1, V1, K2, V2, K3, V3, K4, V4, K5, V5>;
  set(key: K2, value: V2 ): MapADT5<K1, V1, K2, V2, K3, V3, K4, V4, K5, V5>;
  set(key: K3, value: V3 ): MapADT5<K1, V1, K2, V2, K3, V3, K4, V4, K5, V5>;
  set(key: K4, value: V4 ): MapADT5<K1, V1, K2, V2, K3, V3, K4, V4, K5, V5>;
  set(key: K5, value: V5 ): MapADT5<K1, V1, K2, V2, K3, V3, K4, V4, K5, V5>;
  update(key: K1, updateFn: (v: V1) => V1): MapADT5<K1, V1, K2, V2, K3, V3, K4, V4, K5, V5>;
  update(key: K2, updateFn: (v: V2) => V2): MapADT5<K1, V1, K2, V2, K3, V3, K4, V4, K5, V5>;
  update(key: K3, updateFn: (v: V3) => V3): MapADT5<K1, V1, K2, V2, K3, V3, K4, V4, K5, V5>;
  update(key: K4, updateFn: (v: V4) => V4): MapADT5<K1, V1, K2, V2, K3, V3, K4, V4, K5, V5>;
  update(key: K5, updateFn: (v: V5) => V5): MapADT5<K1, V1, K2, V2, K3, V3, K4, V4, K5, V5>;
  get(key: K1): V1;
  get(key: K2): V2;
  get(key: K3): V3;
  get(key: K4): V4;
  get(key: K5): V5;
  // This is probably hard, okay to bail on it for now
  updateIn(ks: Array<any>, updateFn: (v: any) => any): MapADT5<K1, V1, K2, V2, K3, V3, K4, V4, K5, V5>;
}
