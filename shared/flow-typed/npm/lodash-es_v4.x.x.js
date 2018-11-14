// flow-typed signature: 65fe3d22f0866949d449eb0fd198b273
// flow-typed version: 6f07eebf2a/lodash-es_v4.x.x/flow_>=v0.63.x

declare module "lodash-es" {
  declare type __CurriedFunction1<A, R, AA: A> = (...r: [AA]) => R;
  declare type CurriedFunction1<A, R> = __CurriedFunction1<A, R, *>;

  declare type __CurriedFunction2<A, B, R, AA: A, BB: B> = ((
    ...r: [AA]
  ) => CurriedFunction1<BB, R>) &
    ((...r: [AA, BB]) => R);
  declare type CurriedFunction2<A, B, R> = __CurriedFunction2<A, B, R, *, *>;

  declare type __CurriedFunction3<A, B, C, R, AA: A, BB: B, CC: C> = ((
    ...r: [AA]
  ) => CurriedFunction2<BB, CC, R>) &
    ((...r: [AA, BB]) => CurriedFunction1<CC, R>) &
    ((...r: [AA, BB, CC]) => R);
  declare type CurriedFunction3<A, B, C, R> = __CurriedFunction3<
    A,
    B,
    C,
    R,
    *,
    *,
    *
  >;

  declare type __CurriedFunction4<
    A,
    B,
    C,
    D,
    R,
    AA: A,
    BB: B,
    CC: C,
    DD: D
  > = ((...r: [AA]) => CurriedFunction3<BB, CC, DD, R>) &
    ((...r: [AA, BB]) => CurriedFunction2<CC, DD, R>) &
    ((...r: [AA, BB, CC]) => CurriedFunction1<DD, R>) &
    ((...r: [AA, BB, CC, DD]) => R);
  declare type CurriedFunction4<A, B, C, D, R> = __CurriedFunction4<
    A,
    B,
    C,
    D,
    R,
    *,
    *,
    *,
    *
  >;

  declare type __CurriedFunction5<
    A,
    B,
    C,
    D,
    E,
    R,
    AA: A,
    BB: B,
    CC: C,
    DD: D,
    EE: E
  > = ((...r: [AA]) => CurriedFunction4<BB, CC, DD, EE, R>) &
    ((...r: [AA, BB]) => CurriedFunction3<CC, DD, EE, R>) &
    ((...r: [AA, BB, CC]) => CurriedFunction2<DD, EE, R>) &
    ((...r: [AA, BB, CC, DD]) => CurriedFunction1<EE, R>) &
    ((...r: [AA, BB, CC, DD, EE]) => R);
  declare type CurriedFunction5<A, B, C, D, E, R> = __CurriedFunction5<
    A,
    B,
    C,
    D,
    E,
    R,
    *,
    *,
    *,
    *,
    *
  >;

  declare type __CurriedFunction6<
    A,
    B,
    C,
    D,
    E,
    F,
    R,
    AA: A,
    BB: B,
    CC: C,
    DD: D,
    EE: E,
    FF: F
  > = ((...r: [AA]) => CurriedFunction5<BB, CC, DD, EE, FF, R>) &
    ((...r: [AA, BB]) => CurriedFunction4<CC, DD, EE, FF, R>) &
    ((...r: [AA, BB, CC]) => CurriedFunction3<DD, EE, FF, R>) &
    ((...r: [AA, BB, CC, DD]) => CurriedFunction2<EE, FF, R>) &
    ((...r: [AA, BB, CC, DD, EE]) => CurriedFunction1<FF, R>) &
    ((...r: [AA, BB, CC, DD, EE, FF]) => R);
  declare type CurriedFunction6<A, B, C, D, E, F, R> = __CurriedFunction6<
    A,
    B,
    C,
    D,
    E,
    F,
    R,
    *,
    *,
    *,
    *,
    *,
    *
  >;

  declare type Curry = (<A, R>((...r: [A]) => R) => CurriedFunction1<A, R>) &
    (<A, B, R>((...r: [A, B]) => R) => CurriedFunction2<A, B, R>) &
    (<A, B, C, R>((...r: [A, B, C]) => R) => CurriedFunction3<A, B, C, R>) &
    (<A, B, C, D, R>(
      (...r: [A, B, C, D]) => R
    ) => CurriedFunction4<A, B, C, D, R>) &
    (<A, B, C, D, E, R>(
      (...r: [A, B, C, D, E]) => R
    ) => CurriedFunction5<A, B, C, D, E, R>) &
    (<A, B, C, D, E, F, R>(
      (...r: [A, B, C, D, E, F]) => R
    ) => CurriedFunction6<A, B, C, D, E, F, R>);

  declare type UnaryFn<A, R> = (a: A) => R;

  declare type TemplateSettings = {
    escape?: RegExp,
    evaluate?: RegExp,
    imports?: Object,
    interpolate?: RegExp,
    variable?: string
  };

  declare type TruncateOptions = {
    length?: number,
    omission?: string,
    separator?: RegExp | string
  };

  declare type DebounceOptions = {
    leading?: boolean,
    maxWait?: number,
    trailing?: boolean
  };

  declare type ThrottleOptions = {
    leading?: boolean,
    trailing?: boolean
  };

  declare type NestedArray<T> = Array<Array<T>>;

  declare type matchesIterateeShorthand = Object;
  declare type matchesPropertyIterateeShorthand = [string, any];
  declare type propertyIterateeShorthand = string;

  declare type OPredicate<A, O> =
    | ((value: A, key: string, object: O) => any)
    | matchesIterateeShorthand
    | matchesPropertyIterateeShorthand
    | propertyIterateeShorthand;

  declare type OIterateeWithResult<V, O, R> =
    | Object
    | string
    | ((value: V, key: string, object: O) => R);
  declare type OIteratee<O> = OIterateeWithResult<any, O, any>;
  declare type OFlatMapIteratee<T, U> = OIterateeWithResult<any, T, Array<U>>;

  declare type Predicate<T> =
    | ((value: T, index: number, array: Array<T>) => any)
    | matchesIterateeShorthand
    | matchesPropertyIterateeShorthand
    | propertyIterateeShorthand;

  declare type _ValueOnlyIteratee<T> = (value: T) => mixed;
  declare type ValueOnlyIteratee<T> = _ValueOnlyIteratee<T> | string;
  declare type _Iteratee<T> = (
    item: T,
    index: number,
    array: ?Array<T>
  ) => mixed;
  declare type Iteratee<T> = _Iteratee<T> | Object | string;
  declare type FlatMapIteratee<T, U> =
    | ((item: T, index: number, array: ?$ReadOnlyArray<T>) => Array<U>)
    | Object
    | string;
  declare type Comparator<T> = (item: T, item2: T) => boolean;

  declare type MapIterator<T, U> =
    | ((item: T, index: number, array: Array<T>) => U)
    | propertyIterateeShorthand;

  declare type ReadOnlyMapIterator<T, U> =
    | ((item: T, index: number, array: $ReadOnlyArray<T>) => U)
    | propertyIterateeShorthand;

  declare type OMapIterator<T, O, U> =
    | ((item: T, key: string, object: O) => U)
    | propertyIterateeShorthand;

  // Array
  declare export function chunk<T>(array?: ?Array<T>, size?: ?number): Array<Array<T>>;
  declare export function compact<T, N: ?T>(array?: ?Array<N>): Array<T>;
  declare export function concat<T>(base?: ?$ReadOnlyArray<T>, ...elements: Array<any>): Array<T | any>;
  declare export function difference<T>(array?: ?$ReadOnlyArray<T>, ...values: Array<?$ReadOnlyArray<T>>): Array<T>;
  declare export function differenceBy<T>(
    array?: ?$ReadOnlyArray<T>,
    values?: ?$ReadOnlyArray<T>,
    iteratee?: ?ValueOnlyIteratee<T>
  ): T[];
  declare export function differenceWith<T>(array?: ?$ReadOnlyArray<T>, values?: ?$ReadOnlyArray<T>, comparator?: ?Comparator<T>): T[];
  declare export function drop<T>(array?: ?Array<T>, n?: ?number): Array<T>;
  declare export function dropRight<T>(array?: ?Array<T>, n?: ?number): Array<T>;
  declare export function dropRightWhile<T>(array?: ?Array<T>, predicate?: ?Predicate<T>): Array<T>;
  declare export function dropWhile<T>(array?: ?Array<T>, predicate?: ?Predicate<T>): Array<T>;
  declare export function fill<T, U>(
    array?: ?Array<T>,
    value?: ?U,
    start?: ?number,
    end?: ?number
  ): Array<T | U>;
  declare export function findIndex<T>(
    array: $ReadOnlyArray<T>,
    predicate?: ?Predicate<T>,
    fromIndex?: ?number
  ): number;
  declare export function findIndex<T>(
    array: void | null,
    predicate?: ?Predicate<T>,
    fromIndex?: ?number
  ): -1;
  declare export function findLastIndex<T>(
    array: $ReadOnlyArray<T>,
    predicate?: ?Predicate<T>,
    fromIndex?: ?number
  ): number;
  declare export function findLastIndex<T>(
    array: void | null,
    predicate?: ?Predicate<T>,
    fromIndex?: ?number
  ): -1;
  declare export function first<T>(array: ?$ReadOnlyArray<T>): T;
  declare export function flatten<T, X>(array?: ?Array<Array<T> | X>): Array<T | X>;
  declare export function flattenDeep<T>(array?: ?any[]): Array<T>;
  declare export function flattenDepth(array?: ?any[], depth?: ?number): any[];
  declare export function fromPairs<A, B>(pairs?: ?Array<[A, B]>): { [key: A]: B };
  declare export function head<T>(array: ?$ReadOnlyArray<T>): T;
  declare export function indexOf<T>(array: Array<T>, value: T, fromIndex?: number): number;
  declare export function indexOf<T>(array: void | null, value?: ?T, fromIndex?: ?number): -1;
  declare export function initial<T>(array: ?Array<T>): Array<T>;
  declare export function intersection<T>(...arrays?: Array<Array<T>>): Array<T>;
  declare export function intersectionBy<T>(a1?: ?Array<T>, iteratee?: ?ValueOnlyIteratee<T>): Array<T>;
  declare export function intersectionBy<T>(
    a1?: ?Array<T>,
    a2?: ?Array<T>,
    iteratee?: ?ValueOnlyIteratee<T>
  ): Array<T>;
  declare export function intersectionBy<T>(
    a1?: ?Array<T>,
    a2?: ?Array<T>,
    a3?: ?Array<T>,
    iteratee?: ?ValueOnlyIteratee<T>
  ): Array<T>;
  declare export function intersectionBy<T>(
    a1?: ?Array<T>,
    a2?: ?Array<T>,
    a3?: ?Array<T>,
    a4?: ?Array<T>,
    iteratee?: ?ValueOnlyIteratee<T>
  ): Array<T>;
  declare export function intersectionWith<T>(a1?: ?Array<T>, comparator?: ?Comparator<T>): Array<T>;
  declare export function intersectionWith<T>(
    a1?: ?Array<T>,
    a2?: ?Array<T>,
    comparator?: ?Comparator<T>
  ): Array<T>;
  declare export function intersectionWith<T>(
    a1?: ?Array<T>,
    a2?: ?Array<T>,
    a3?: ?Array<T>,
    comparator?: ?Comparator<T>
  ): Array<T>;
  declare export function intersectionWith<T>(
    a1?: ?Array<T>,
    a2?: ?Array<T>,
    a3?: ?Array<T>,
    a4?: ?Array<T>,
    comparator?: ?Comparator<T>
  ): Array<T>;
  declare export function join<T>(array: Array<T>, separator?: ?string): string;
  declare export function join<T>(array: void | null, separator?: ?string): '';
  declare export function last<T>(array: ?$ReadOnlyArray<T>): T;
  declare export function lastIndexOf<T>(array: Array<T>, value?: ?T, fromIndex?: ?number): number;
  declare export function lastIndexOf<T>(array: void | null, value?: ?T, fromIndex?: ?number): -1;
  declare export function nth<T>(array: T[], n?: ?number): T;
  declare export function nth(array: void | null, n?: ?number): void;
  declare export function pull<T>(array: Array<T>, ...values?: Array<?T>): Array<T>;
  declare export function pull<T: void | null>(array: T, ...values?: Array<?any>): T;
  declare export function pullAll<T>(array: Array<T>, values?: ?Array<T>): Array<T>;
  declare export function pullAll<T: void | null>(array: T, values?: ?Array<any>): T;
  declare export function pullAllBy<T>(
    array: Array<T>,
    values?: ?Array<T>,
    iteratee?: ?ValueOnlyIteratee<T>
  ): Array<T>;
  declare export function pullAllBy<T: void | null>(
    array: T,
    values?: ?Array<any>,
    iteratee?: ?ValueOnlyIteratee<any>
  ): T;
  declare export function pullAllWith<T>(array: T[], values?: ?T[], comparator?: ?Function): T[];
  declare export function pullAllWith<T: void | null>(array: T, values?: ?Array<any>, comparator?: ?Function): T;
  declare export function pullAt<T>(array?: ?Array<T>, ...indexed?: Array<?number>): Array<T>;
  declare export function pullAt<T>(array?: ?Array<T>, indexed?: ?Array<number>): Array<T>;
  declare export function remove<T>(array?: ?Array<T>, predicate?: ?Predicate<T>): Array<T>;
  declare export function reverse<T>(array: Array<T>): Array<T>;
  declare export function reverse<T: void | null>(array: T): T;
  declare export function slice<T>(array?: ?$ReadOnlyArray<T>, start?: ?number, end?: ?number): Array<T>;
  declare export function sortedIndex<T>(array: Array<T>, value: T): number;
  declare export function sortedIndex<T>(array: void | null, value: ?T): 0;
  declare export function sortedIndexBy<T>(
    array: Array<T>,
    value?: ?T,
    iteratee?: ?ValueOnlyIteratee<T>
  ): number;
  declare export function sortedIndexBy<T>(
    array: void | null,
    value?: ?T,
    iteratee?: ?ValueOnlyIteratee<T>
  ): 0;
  declare export function sortedIndexOf<T>(array: Array<T>, value: T): number;
  declare export function sortedIndexOf<T>(array: void | null, value?: ?T): -1;
  declare export function sortedLastIndex<T>(array: Array<T>, value: T): number;
  declare export function sortedLastIndex<T>(array: void | null, value?: ?T): 0;
  declare export function sortedLastIndexBy<T>(
    array: Array<T>,
    value: T,
    iteratee?: ValueOnlyIteratee<T>
  ): number;
  declare export function sortedLastIndexBy<T>(
    array: void | null,
    value?: ?T,
    iteratee?: ?ValueOnlyIteratee<T>
  ): 0;
  declare export function sortedLastIndexOf<T>(array: Array<T>, value: T): number;
  declare export function sortedLastIndexOf<T>(array: void | null, value?: ?T): -1;
  declare export function sortedUniq<T>(array?: ?Array<T>): Array<T>;
  declare export function sortedUniqBy<T>(array?: ?Array<T>, iteratee?: ?(value: T) => mixed): Array<T>;
  declare export function tail<T>(array?: ?Array<T>): Array<T>;
  declare export function take<T>(array?: ?Array<T>, n?: ?number): Array<T>;
  declare export function takeRight<T>(array?: ?Array<T>, n?: ?number): Array<T>;
  declare export function takeRightWhile<T>(array?: ?Array<T>, predicate?: ?Predicate<T>): Array<T>;
  declare export function takeWhile<T>(array?: ?Array<T>, predicate?: ?Predicate<T>): Array<T>;
  declare export function union<T>(...arrays?: Array<Array<T>>): Array<T>;
  declare export function unionBy<T>(a1?: ?Array<T>, iteratee?: ?ValueOnlyIteratee<T>): Array<T>;
  declare export function unionBy<T>(
    a1?: ?Array<T>,
    a2: Array<T>,
    iteratee?: ValueOnlyIteratee<T>
  ): Array<T>;
  declare export function unionBy<T>(
    a1: Array<T>,
    a2: Array<T>,
    a3: Array<T>,
    iteratee?: ValueOnlyIteratee<T>
  ): Array<T>;
  declare export function unionBy<T>(
    a1: Array<T>,
    a2: Array<T>,
    a3: Array<T>,
    a4: Array<T>,
    iteratee?: ValueOnlyIteratee<T>
  ): Array<T>;
  declare export function unionWith<T>(a1?: ?Array<T>, comparator?: ?Comparator<T>): Array<T>;
  declare export function unionWith<T>(
    a1: Array<T>,
    a2: Array<T>,
    comparator?: Comparator<T>
  ): Array<T>;
  declare export function unionWith<T>(
    a1: Array<T>,
    a2: Array<T>,
    a3: Array<T>,
    comparator?: Comparator<T>
  ): Array<T>;
  declare export function unionWith<T>(
    a1: Array<T>,
    a2: Array<T>,
    a3: Array<T>,
    a4: Array<T>,
    comparator?: Comparator<T>
  ): Array<T>;
  declare export function uniq<T>(array?: ?Array<T>): Array<T>;
  declare export function uniqBy<T>(array?: ?Array<T>, iteratee?: ?ValueOnlyIteratee<T>): Array<T>;
  declare export function uniqWith<T>(array?: ?Array<T>, comparator?: ?Comparator<T>): Array<T>;
  declare export function unzip<T>(array?: ?Array<T>): Array<T>;
  declare export function unzipWith<T>(array: ?Array<T>, iteratee?: ?Iteratee<T>): Array<T>;
  declare export function without<T>(array?: ?$ReadOnlyArray<T>, ...values?: Array<?T>): Array<T>;
  declare export function xor<T>(...array: Array<Array<T>>): Array<T>;
  declare export function xorBy<T>(a1?: ?Array<T>, iteratee?: ?ValueOnlyIteratee<T>): Array<T>;
  declare export function xorBy<T>(
    a1: Array<T>,
    a2: Array<T>,
    iteratee?: ValueOnlyIteratee<T>
  ): Array<T>;
  declare export function xorBy<T>(
    a1: Array<T>,
    a2: Array<T>,
    a3: Array<T>,
    iteratee?: ValueOnlyIteratee<T>
  ): Array<T>;
  declare export function xorBy<T>(
    a1: Array<T>,
    a2: Array<T>,
    a3: Array<T>,
    a4: Array<T>,
    iteratee?: ValueOnlyIteratee<T>
  ): Array<T>;
  declare export function xorWith<T>(a1?: ?Array<T>, comparator?: ?Comparator<T>): Array<T>;
  declare export function xorWith<T>(
    a1: Array<T>,
    a2: Array<T>,
    comparator?: Comparator<T>
  ): Array<T>;
  declare export function xorWith<T>(
    a1: Array<T>,
    a2: Array<T>,
    a3: Array<T>,
    comparator?: Comparator<T>
  ): Array<T>;
  declare export function xorWith<T>(
    a1: Array<T>,
    a2: Array<T>,
    a3: Array<T>,
    a4: Array<T>,
    comparator?: Comparator<T>
  ): Array<T>;
  declare export function zip<A, B>(a1?: ?A[], a2?: ?B[]): Array<[A, B]>;
  declare export function zip<A, B, C>(a1: A[], a2: B[], a3: C[]): Array<[A, B, C]>;
  declare export function zip<A, B, C, D>(a1: A[], a2: B[], a3: C[], a4: D[]): Array<[A, B, C, D]>;
  declare export function zip<A, B, C, D, E>(
    a1: A[],
    a2: B[],
    a3: C[],
    a4: D[],
    a5: E[]
  ): Array<[A, B, C, D, E]>;

  declare export function zipObject<K, V>(props: Array<K>, values?: ?Array<V>): { [key: K]: V };
  declare export function zipObject<K, V>(props: void | null, values?: ?Array<V>): {};
  declare export function zipObjectDeep(props: any[], values?: ?any): Object;
  declare export function zipObjectDeep(props: void | null, values?: ?any): {};

  declare export function zipWith<A>(a1?: ?Array<A>): Array<[A]>;
  declare export function zipWith<T, A>(a1: Array<A>, iteratee: (A) => T): Array<T>;

  declare export function zipWith<A, B>(a1: Array<A>, a2: Array<B>): Array<[A, B]>;
  declare export function zipWith<T, A, B>(
    a1: Array<A>,
    a2: Array<B>,
    iteratee: (A, B) => T
  ): Array<T>;

  declare export function zipWith<A, B, C>(
    a1: Array<A>,
    a2: Array<B>,
    a3: Array<C>
  ): Array<[A, B, C]>;
  declare export function zipWith<T, A, B, C>(
    a1: Array<A>,
    a2: Array<B>,
    a3: Array<C>,
    iteratee: (A, B, C) => T
  ): Array<T>;

  declare export function zipWith<A, B, C, D>(
    a1: Array<A>,
    a2: Array<B>,
    a3: Array<C>,
    a4: Array<D>
  ): Array<[A, B, C, D]>;
  declare export function zipWith<T, A, B, C, D>(
    a1: Array<A>,
    a2: Array<B>,
    a3: Array<C>,
    a4: Array<D>,
    iteratee: (A, B, C, D) => T
  ): Array<T>;

  // Collection
  declare export function countBy<T>(array: Array<T>, iteratee?: ?ValueOnlyIteratee<T>): Object;
  declare export function countBy<T>(array: void | null, iteratee?: ?ValueOnlyIteratee<T>): {};
  declare export function countBy<T: Object>(object: T, iteratee?: ?ValueOnlyIteratee<T>): Object;
  declare export function each<T>(array: $ReadOnlyArray<T>, iteratee?: ?Iteratee<T>): Array<T>;
  declare export function each<T: void | null>(array: T, iteratee?: ?Iteratee<any>): T;
  declare export function each<T: Object>(object: T, iteratee?: ?OIteratee<T>): T;
  declare export function eachRight<T>(array: $ReadOnlyArray<T>, iteratee?: ?Iteratee<T>): Array<T>;
  declare export function eachRight<T: void | null>(array: T, iteratee?: ?Iteratee<any>): T;
  declare export function eachRight<T: Object>(object: T, iteratee?: OIteratee<T>): T;
  declare export function every<T>(array?: ?$ReadOnlyArray<T>, iteratee?: ?Iteratee<T>): boolean;
  declare export function every<T: Object>(object: T, iteratee?: OIteratee<T>): boolean;
  declare export function filter<T>(array?: ?$ReadOnlyArray<T>, predicate?: ?Predicate<T>): Array<T>;
  declare export function filter<A, T: { [id: string]: A }>(
    object: T,
    predicate?: OPredicate<A, T>
  ): Array<A>;
  declare export function find<T>(
    array: $ReadOnlyArray<T>,
    predicate?: ?Predicate<T>,
    fromIndex?: ?number
  ): T | void;
  declare export function find<T>(
    array: void | null,
    predicate?: ?Predicate<T>,
    fromIndex?: ?number
  ): void;
  declare export function find<V, A, T: { [id: string]: A }>(
    object: T,
    predicate?: OPredicate<A, T>,
    fromIndex?: number
  ): V;
  declare export function findLast<T>(
    array: ?$ReadOnlyArray<T>,
    predicate?: ?Predicate<T>,
    fromIndex?: ?number
  ): T | void;
  declare export function findLast<V, A, T: { [id: string]: A }>(
    object: T,
    predicate?: ?OPredicate<A, T>
  ): V;
  declare export function flatMap<T, U>(
    array?: ?$ReadOnlyArray<T>,
    iteratee?: ?FlatMapIteratee<T, U>
  ): Array<U>;
  declare export function flatMap<T: Object, U>(
    object: T,
    iteratee?: OFlatMapIteratee<T, U>
  ): Array<U>;
  declare export function flatMapDeep<T, U>(
    array?: ?$ReadOnlyArray<T>,
    iteratee?: ?FlatMapIteratee<T, U>
  ): Array<U>;
  declare export function flatMapDeep<T: Object, U>(
    object: T,
    iteratee?: ?OFlatMapIteratee<T, U>
  ): Array<U>;
  declare export function flatMapDepth<T, U>(
    array?: ?Array<T>,
    iteratee?: ?FlatMapIteratee<T, U>,
    depth?: ?number
  ): Array<U>;
  declare export function flatMapDepth<T: Object, U>(
    object: T,
    iteratee?: OFlatMapIteratee<T, U>,
    depth?: number
  ): Array<U>;
  declare export function forEach<T>(array: $ReadOnlyArray<T>, iteratee?: ?Iteratee<T>): Array<T>;
  declare export function forEach<T: void | null>(array: T, iteratee?: ?Iteratee<any>): T;
  declare export function forEach<T: Object>(object: T, iteratee?: ?OIteratee<T>): T;
  declare export function forEachRight<T>(array: $ReadOnlyArray<T>, iteratee?: ?Iteratee<T>): Array<T>;
  declare export function forEachRight<T: void | null>(array: T, iteratee?: ?Iteratee<any>): T;
  declare export function forEachRight<T: Object>(object: T, iteratee?: ?OIteratee<T>): T;
  declare export function groupBy<V, T>(
    array: $ReadOnlyArray<T>,
    iteratee?: ?ValueOnlyIteratee<T>
  ): { [key: V]: Array<T> };
  declare export function groupBy(
    array: void | null,
    iteratee?: ?ValueOnlyIteratee<any>
  ): {};
  declare export function groupBy<V, A, T: { [id: string]: A }>(
    object: T,
    iteratee?: ValueOnlyIteratee<A>
  ): { [key: V]: Array<A> };
  declare export function includes<T>(array: $ReadOnlyArray<T>, value: T, fromIndex?: ?number): boolean;
  declare export function includes<T>(array: void | null, value?: ?T, fromIndex?: ?number): false;
  declare export function includes<T: Object>(object: T, value: any, fromIndex?: number): boolean;
  declare export function includes(str: string, value: string, fromIndex?: number): boolean;
  declare export function invokeMap<T>(
    array?: ?Array<T>,
    path?: ?((value: T) => Array<string> | string) | Array<string> | string,
    ...args?: Array<any>
  ): Array<any>;
  declare export function invokeMap<T: Object>(
    object: T,
    path: ((value: any) => Array<string> | string) | Array<string> | string,
    ...args?: Array<any>
  ): Array<any>;
  declare export function keyBy<T, V>(
    array: $ReadOnlyArray<T>,
    iteratee?: ?ValueOnlyIteratee<T>
  ): { [key: V]: ?T };
  declare export function keyBy(
    array: void | null,
    iteratee?: ?ValueOnlyIteratee<*>
  ): {};
  declare export function keyBy<V, A, I, T: { [id: I]: A }>(
    object: T,
    iteratee?: ?ValueOnlyIteratee<A>
  ): { [key: V]: ?A };
  declare export function map<T, U>(array?: ?Array<T>, iteratee?: ?MapIterator<T, U>): Array<U>;
  declare export function map<T, U>(
    array: ?$ReadOnlyArray<T>,
    iteratee?: ReadOnlyMapIterator<T, U>
  ): Array<U>;
  declare export function map<V, T: Object, U>(
    object: ?T,
    iteratee?: OMapIterator<V, T, U>
  ): Array<U>;
  declare export function map(
    str: ?string,
    iteratee?: (char: string, index: number, str: string) => any
  ): string;
  declare export function orderBy<T>(
    array: $ReadOnlyArray<T>,
    iteratees?: ?$ReadOnlyArray<Iteratee<T>> | ?string,
    orders?: ?$ReadOnlyArray<"asc" | "desc"> | ?string
  ): Array<T>;
  declare export function orderBy<T>(
    array: null | void,
    iteratees?: ?$ReadOnlyArray<Iteratee<T>> | ?string,
    orders?: ?$ReadOnlyArray<"asc" | "desc"> | ?string
  ): Array<T>;
  declare export function orderBy<V, T: Object>(
    object: T,
    iteratees?: $ReadOnlyArray<OIteratee<*>> | string,
    orders?: $ReadOnlyArray<"asc" | "desc"> | string
  ): Array<V>;
  declare export function partition<T>(
    array?: ?Array<T>,
    predicate?: ?Predicate<T>
  ): [Array<T>, Array<T>];
  declare export function partition<V, A, T: { [id: string]: A }>(
    object: T,
    predicate?: OPredicate<A, T>
  ): [Array<V>, Array<V>];
  declare export function reduce<T, U>(
    array: Array<T>,
    iteratee?: (
      accumulator: U,
      value: T,
      index: number,
      array: ?Array<T>
    ) => U,
    accumulator?: U
  ): U;
  declare export function reduce<T, U>(
    array: void | null,
    iteratee?: ?(
      accumulator: U,
      value: T,
      index: number,
      array: ?Array<T>
    ) => U,
    accumulator?: ?U
  ): void | null;
  declare export function reduce<T: Object, U>(
    object: T,
    iteratee?: (accumulator: U, value: any, key: string, object: T) => U,
    accumulator?: U
  ): U;
  declare export function reduceRight<T, U>(
    array: void | null,
    iteratee?: ?(
      accumulator: U,
      value: T,
      index: number,
      array: ?Array<T>
    ) => U,
    accumulator?: ?U
  ): void | null;
  declare export function reduceRight<T, U>(
    array: Array<T>,
    iteratee?: ?(
      accumulator: U,
      value: T,
      index: number,
      array: ?Array<T>
    ) => U,
    accumulator?: ?U
  ): U;
  declare export function reduceRight<T: Object, U>(
    object: T,
    iteratee?: ?(accumulator: U, value: any, key: string, object: T) => U,
    accumulator?: ?U
  ): U;
  declare export function reject<T>(array: ?$ReadOnlyArray<T>, predicate?: Predicate<T>): Array<T>;
  declare export function reject<V: Object, A, T: { [id: string]: A }>(
    object?: ?T,
    predicate?: ?OPredicate<A, T>
  ): Array<V>;
  declare export function sample<T>(array: ?Array<T>): T;
  declare export function sample<V, T: Object>(object: T): V;
  declare export function sampleSize<T>(array?: ?Array<T>, n?: ?number): Array<T>;
  declare export function sampleSize<V, T: Object>(object: T, n?: number): Array<V>;
  declare export function shuffle<T>(array: ?Array<T>): Array<T>;
  declare export function shuffle<V, T: Object>(object: T): Array<V>;
  declare export function size(collection: $ReadOnlyArray<any> | Object | string): number;
  declare export function some<T>(array: ?$ReadOnlyArray<T>, predicate?: Predicate<T>): boolean;
  declare export function some<T>(array: void | null, predicate?: ?Predicate<T>): false;
  declare export function some<A, T: { [id: string]: A }>(
    object?: ?T,
    predicate?: OPredicate<A, T>
  ): boolean;
  declare export function sortBy<T>(
    array: ?$ReadOnlyArray<T>,
    ...iteratees?: $ReadOnlyArray<Iteratee<T>>
  ): Array<T>;
  declare export function sortBy<T>(
    array: ?$ReadOnlyArray<T>,
    iteratees?: $ReadOnlyArray<Iteratee<T>>
  ): Array<T>;
  declare export function sortBy<V, T: Object>(
    object: T,
    ...iteratees?: Array<OIteratee<T>>
  ): Array<V>;
  declare export function sortBy<V, T: Object>(
    object: T,
    iteratees?: $ReadOnlyArray<OIteratee<T>>
  ): Array<V>;

  // Date
  declare export function now(): number;

  // Function
  declare export function after(n: number, fn: Function): Function;
  declare export function ary(func: Function, n?: number): Function;
  declare export function before(n: number, fn: Function): Function;
  declare export function bind(func: Function, thisArg: any, ...partials: Array<any>): Function;
  declare export function bindKey(obj?: ?Object, key?: ?string, ...partials?: Array<?any>): Function;
  declare export var curry: Curry;
  declare export function curry(func: Function, arity?: number): Function;
  declare export function curryRight(func: Function, arity?: number): Function;
  declare export function debounce<F: Function>(func: F, wait?: number, options?: DebounceOptions): F;
  declare export function defer(func: Function, ...args?: Array<any>): TimeoutID;
  declare export function delay(func: Function, wait: number, ...args?: Array<any>): TimeoutID;
  declare export function flip(func: Function): Function;
  declare export function memoize<F: Function>(func: F, resolver?: Function): F;
  declare export function negate(predicate: Function): Function;
  declare export function once(func: Function): Function;
  declare export function overArgs(func?: ?Function, ...transforms?: Array<Function>): Function;
  declare export function overArgs(func?: ?Function, transforms?: ?Array<Function>): Function;
  declare export function partial(func: Function, ...partials: any[]): Function;
  declare export function partialRight(func: Function, ...partials: Array<any>): Function;
  declare export function partialRight(func: Function, partials: Array<any>): Function;
  declare export function rearg(func: Function, ...indexes: Array<number>): Function;
  declare export function rearg(func: Function, indexes: Array<number>): Function;
  declare export function rest(func: Function, start?: number): Function;
  declare export function spread(func: Function): Function;
  declare export function throttle(
    func: Function,
    wait?: number,
    options?: ThrottleOptions
  ): Function;
  declare export function unary(func: Function): Function;
  declare export function wrap(value?: any, wrapper?: ?Function): Function;

  // Lang
  declare export function castArray(value: *): any[];
  declare export function clone<T>(value: T): T;
  declare export function cloneDeep<T>(value: T): T;
  declare export function cloneDeepWith<T, U>(
    value: T,
    customizer?: ?(value: T, key: number | string, object: T, stack: any) => U
  ): U;
  declare export function cloneWith<T, U>(
    value: T,
    customizer?: ?(value: T, key: number | string, object: T, stack: any) => U
  ): U;
  declare export function conformsTo<T: { [key: string]: mixed }>(
    source: T,
    predicates: T & { [key: string]: (x: any) => boolean }
  ): boolean;
  declare export function eq(value: any, other: any): boolean;
  declare export function gt(value: any, other: any): boolean;
  declare export function gte(value: any, other: any): boolean;
  declare export function isArguments(value: void | null): false;
  declare export function isArguments(value: any): boolean;
  declare export function isArray(value: Array<any>): true;
  declare export function isArray(value: any): false;
  declare export function isArrayBuffer(value: ArrayBuffer): true;
  declare export function isArrayBuffer(value: any): false;
  declare export function isArrayLike(value: Array<any> | string | {length: number}): true;
  declare export function isArrayLike(value: any): false;
  declare export function isArrayLikeObject(value: {length: number} | Array<any>): true;
  declare export function isArrayLikeObject(value: any): false;
  declare export function isBoolean(value: boolean): true;
  declare export function isBoolean(value: any): false;
  declare export function isBuffer(value: void | null): false;
  declare export function isBuffer(value: any): boolean;
  declare export function isDate(value: Date): true;
  declare export function isDate(value: any): false;
  declare export function isElement(value: Element): true;
  declare export function isElement(value: any): false;
  declare export function isEmpty(value: void | null | '' | {} | [] | number | boolean): true;
  declare export function isEmpty(value: any): boolean;
  declare export function isEqual(value: any, other: any): boolean;
  declare export function isEqualWith<T, U>(
    value?: ?T,
    other?: ?U,
    customizer?: ?(
      objValue: any,
      otherValue: any,
      key: number | string,
      object: T,
      other: U,
      stack: any
    ) => boolean | void
  ): boolean;
  declare export function isError(value: Error): true;
  declare export function isError(value: any): false;
  declare export function isFinite(value: number): boolean;
  declare export function isFinite(value: any): false;
  declare export function isFunction(value: Function): true;
  declare export function isFunction(value: any): false;
  declare export function isInteger(value: number): boolean;
  declare export function isInteger(value: any): false;
  declare export function isLength(value: void | null): false;
  declare export function isLength(value: any): boolean;
  declare export function isMap(value: Map<any, any>): true;
  declare export function isMap(value: any): false;
  declare export function isMatch(object?: ?Object, source?: ?Object): boolean;
  declare export function isMatchWith<T: Object, U: Object>(
    object?: ?T,
    source?: ?U,
    customizer?: ?(
      objValue: any,
      srcValue: any,
      key: number | string,
      object: T,
      source: U
    ) => boolean | void
  ): boolean;
  declare export function isNaN(value: number): boolean;
  declare export function isNaN(value: any): false;
  declare export function isNative(value: number | string | void | null | Object): false;
  declare export function isNative(value: any): boolean;
  declare export function isNil(value: void | null): true;
  declare export function isNil(value: any): false;
  declare export function isNull(value: null): true;
  declare export function isNull(value: any): false;
  declare export function isNumber(value: number): true;
  declare export function isNumber(value: any): false;
  declare export function isObject(value: Object): true;
  declare export function isObject(value: any): false;
  declare export function isObjectLike(value: void | null): false;
  declare export function isObjectLike(value: any): boolean;
  declare export function isPlainObject(value: Object): true;
  declare export function isPlainObject(value: any): false;
  declare export function isRegExp(value: RegExp): true;
  declare export function isRegExp(value: any): false;
  declare export function isSafeInteger(value: number): boolean;
  declare export function isSafeInteger(value: any): false;
  declare export function isSet(value: Set<any>): true;
  declare export function isSet(value: any): false;
  declare export function isString(value: string): true;
  declare export function isString(value: any): false;
  declare export function isSymbol(value: Symbol): true;
  declare export function isSymbol(value: any): false;
  declare export function isTypedArray(value: $TypedArray): true;
  declare export function isTypedArray(value: any): false;
  declare export function isUndefined(value: void): true;
  declare export function isUndefined(value: any): false;
  declare export function isWeakMap(value: WeakMap<any, any>): true;
  declare export function isWeakMap(value: any): false;
  declare export function isWeakSet(value: WeakSet<any>): true;
  declare export function isWeakSet(value: any): false;
  declare export function lt(value: any, other: any): boolean;
  declare export function lte(value: any, other: any): boolean;
  declare export function toArray(value: any): Array<any>;
  declare export function toFinite(value: void | null): 0;
  declare export function toFinite(value: any): number;
  declare export function toInteger(value: void | null): 0;
  declare export function toInteger(value: any): number;
  declare export function toLength(value: void | null): 0;
  declare export function toLength(value: any): number;
  declare export function toNumber(value: void | null): 0;
  declare export function toNumber(value: any): number;
  declare export function toPlainObject(value: any): Object;
  declare export function toSafeInteger(value: void | null): 0;
  declare export function toSafeInteger(value: any): number;
  declare export function toString(value: void | null): '';
  declare export function toString(value: any): string;

  // Math
  declare export function add(augend: number, addend: number): number;
  declare export function ceil(number: number, precision?: number): number;
  declare export function divide(dividend: number, divisor: number): number;
  declare export function floor(number: number, precision?: number): number;
  declare export function max<T>(array: ?Array<T>): T;
  declare export function maxBy<T>(array: ?$ReadOnlyArray<T>, iteratee?: Iteratee<T>): T;
  declare export function mean(array: Array<*>): number;
  declare export function meanBy<T>(array: Array<T>, iteratee?: Iteratee<T>): number;
  declare export function min<T>(array: ?Array<T>): T;
  declare export function minBy<T>(array: ?$ReadOnlyArray<T>, iteratee?: Iteratee<T>): T;
  declare export function multiply(multiplier: number, multiplicand: number): number;
  declare export function round(number: number, precision?: number): number;
  declare export function subtract(minuend: number, subtrahend: number): number;
  declare export function sum(array: Array<*>): number;
  declare export function sumBy<T>(array: Array<T>, iteratee?: Iteratee<T>): number;

  // number
  declare export function clamp(number?: number, lower?: ?number, upper?: ?number): number;
  declare export function clamp(number: ?number, lower?: ?number, upper?: ?number): 0;
  declare export function inRange(number: number, start?: number, end: number): boolean;
  declare export function random(lower?: number, upper?: number, floating?: boolean): number;

  // Object
  declare export function assign(object?: ?Object, ...sources?: Array<?Object>): Object;
  declare export function assignIn(): {};
  declare export function assignIn<A, B>(a: A, b: B): A & B;
  declare export function assignIn<A, B, C>(a: A, b: B, c: C): A & B & C;
  declare export function assignIn<A, B, C, D>(a: A, b: B, c: C, d: D): A & B & C & D;
  declare export function assignIn<A, B, C, D, E>(a: A, b: B, c: C, d: D, e: E): A & B & C & D & E;
  declare export function assignInWith(): {};
  declare export function assignInWith<T: Object, A: Object>(
    object: T,
    s1: A,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A
    ) => any | void
  ): Object;
  declare export function assignInWith<T: Object, A: Object, B: Object>(
    object: T,
    s1: A,
    s2: B,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A | B
    ) => any | void
  ): Object;
  declare export function assignInWith<T: Object, A: Object, B: Object, C: Object>(
    object: T,
    s1: A,
    s2: B,
    s3: C,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A | B | C
    ) => any | void
  ): Object;
  declare export function assignInWith<T: Object, A: Object, B: Object, C: Object, D: Object>(
    object: T,
    s1: A,
    s2: B,
    s3: C,
    s4: D,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A | B | C | D
    ) => any | void
  ): Object;
  declare export function assignWith(): {};
  declare export function assignWith<T: Object, A: Object>(
    object: T,
    s1: A,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A
    ) => any | void
  ): Object;
  declare export function assignWith<T: Object, A: Object, B: Object>(
    object: T,
    s1: A,
    s2: B,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A | B
    ) => any | void
  ): Object;
  declare export function assignWith<T: Object, A: Object, B: Object, C: Object>(
    object: T,
    s1: A,
    s2: B,
    s3: C,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A | B | C
    ) => any | void
  ): Object;
  declare export function assignWith<T: Object, A: Object, B: Object, C: Object, D: Object>(
    object: T,
    s1: A,
    s2: B,
    s3: C,
    s4: D,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A | B | C | D
    ) => any | void
  ): Object;
  declare export function at(object?: ?Object, ...paths: Array<string>): Array<any>;
  declare export function at(object?: ?Object, paths: Array<string>): Array<any>;
  declare export function create<T>(prototype: T, properties: Object): $Supertype<T>;
  declare export function create(prototype: any, properties: void | null): {};
  declare export function defaults(object?: ?Object, ...sources?: Array<?Object>): Object;
  declare export function defaultsDeep(object?: ?Object, ...sources?: Array<?Object>): Object;
  // alias for _.toPairs
  declare export function entries(object?: ?Object): Array<[string, any]>;
  // alias for _.toPairsIn
  declare export function entriesIn(object?: ?Object): Array<[string, any]>;
  // alias for _.assignIn
  declare export function extend<A, B>(a?: ?A, b?: ?B): A & B;
  declare export function extend<A, B, C>(a: A, b: B, c: C): A & B & C;
  declare export function extend<A, B, C, D>(a: A, b: B, c: C, d: D): A & B & C & D;
  declare export function extend<A, B, C, D, E>(a: A, b: B, c: C, d: D, e: E): A & B & C & D & E;
  // alias for _.assignInWith
  declare export function extendWith<T: Object, A: Object>(
    object?: ?T,
    s1?: ?A,
    customizer?: ?(
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A
    ) => any | void
  ): Object;
  declare export function extendWith<T: Object, A: Object, B: Object>(
    object: T,
    s1: A,
    s2: B,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A | B
    ) => any | void
  ): Object;
  declare export function extendWith<T: Object, A: Object, B: Object, C: Object>(
    object: T,
    s1: A,
    s2: B,
    s3: C,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A | B | C
    ) => any | void
  ): Object;
  declare export function extendWith<T: Object, A: Object, B: Object, C: Object, D: Object>(
    object: T,
    s1: A,
    s2: B,
    s3: C,
    s4: D,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A | B | C | D
    ) => any | void
  ): Object;
  declare export function findKey<A, T: { [id: string]: A }>(
    object: T,
    predicate?: ?OPredicate<A, T>
  ): string | void;
  declare export function findKey<A, T: { [id: string]: A }>(
    object: void | null,
    predicate?: ?OPredicate<A, T>
  ): void;
  declare export function findLastKey<A, T: { [id: string]: A }>(
    object: T,
    predicate?: ?OPredicate<A, T>
  ): string | void;
  declare export function findLastKey<A, T: { [id: string]: A }>(
    object: void | null,
    predicate?: ?OPredicate<A, T>
  ): void;
  declare export function forIn(object: Object, iteratee?: ?OIteratee<*>): Object;
  declare export function forIn(object: void | null, iteratee?: ?OIteratee<*>): null;
  declare export function forInRight(object: Object, iteratee?: ?OIteratee<*>): Object;
  declare export function forInRight(object: void | null, iteratee?: ?OIteratee<*>): null;
  declare export function forOwn(object: Object, iteratee?: ?OIteratee<*>): Object;
  declare export function forOwn(object: void | null, iteratee?: ?OIteratee<*>): null;
  declare export function forOwnRight(object: Object, iteratee?: ?OIteratee<*>): Object;
  declare export function forOwnRight(object: void | null, iteratee?: ?OIteratee<*>): null;
  declare export function functions(object?: ?Object): Array<string>;
  declare export function functionsIn(object?: ?Object): Array<string>;
  declare export function get(
    object?: ?Object | ?$ReadOnlyArray<any> | void | null,
    path?: ?$ReadOnlyArray<string | number> | string | number,
    defaultValue?: any
  ): any;
  declare export function has(object: Object, path: Array<string> | string): boolean;
  declare export function has(object: Object, path: void | null): false;
  declare export function has(object: void | null, path?: ?Array<string> | ?string): false;
  declare export function hasIn(object: Object, path: Array<string> | string): boolean;
  declare export function hasIn(object: Object, path: void | null): false;
  declare export function hasIn(object: void | null, path?: ?Array<string> | ?string): false;
  declare export function invert(object: Object, multiVal?: ?boolean): Object;
  declare export function invert(object: void | null, multiVal?: ?boolean): {};
  declare export function invertBy(object: Object, iteratee?: ?Function): Object;
  declare export function invertBy(object: void | null, iteratee?: ?Function): {};
  declare export function invoke(
    object?: ?Object,
    path?: ?Array<string> | string,
    ...args?: Array<any>
  ): any;
  declare export function keys<K>(object?: ?{ [key: K]: any }): Array<K>;
  declare export function keys(object?: ?Object): Array<string>;
  declare export function keysIn(object?: ?Object): Array<string>;
  declare export function mapKeys(object: Object, iteratee?: ?OIteratee<*>): Object;
  declare export function mapKeys(object: void | null, iteratee?: ?OIteratee<*>): {};
  declare export function mapValues(object: Object, iteratee?: ?OIteratee<*>): Object;
  declare export function mapValues(object: void | null, iteratee?: ?OIteratee<*>): {};
  declare export function merge(object?: ?Object, ...sources?: Array<?Object>): Object;
  declare export function mergeWith(): {};
  declare export function mergeWith<T: Object, A: Object>(
    object: T,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A
    ) => any | void
  ): Object;
  declare export function mergeWith<T: Object, A: Object, B: Object>(
    object: T,
    s1: A,
    s2: B,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A | B
    ) => any | void
  ): Object;
  declare export function mergeWith<T: Object, A: Object, B: Object, C: Object>(
    object: T,
    s1: A,
    s2: B,
    s3: C,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A | B | C
    ) => any | void
  ): Object;
  declare export function mergeWith<T: Object, A: Object, B: Object, C: Object, D: Object>(
    object: T,
    s1: A,
    s2: B,
    s3: C,
    s4: D,
    customizer?: (
      objValue: any,
      srcValue: any,
      key: string,
      object: T,
      source: A | B | C | D
    ) => any | void
  ): Object;
  declare export function omit(object?: ?Object, ...props: Array<string>): Object;
  declare export function omit(object?: ?Object, props: Array<string>): Object;
  declare export function omitBy<A, T: { [id: string]: A }>(
    object: T,
    predicate?: ?OPredicate<A, T>
  ): Object;
  declare export function omitBy<A, T>(
    object: void | null,
    predicate?: ?OPredicate<A, T>
  ): {};
  declare export function pick(object?: ?Object, ...props: Array<string>): Object;
  declare export function pick(object?: ?Object, props: Array<string>): Object;
  declare export function pickBy<A, T: { [id: string]: A }>(
    object: T,
    predicate?: ?OPredicate<A, T>
  ): Object;
  declare export function pickBy<A, T>(
    object: void | null,
    predicate?: ?OPredicate<A, T>
  ): {};
  declare export function result(
    object?: ?Object,
    path?: ?Array<string> | string,
    defaultValue?: any
  ): any;
  declare export function set(object: Object, path?: ?Array<string> | string, value: any): Object;
  declare export function set<T: void | null>(
    object: T,
    path?: ?Array<string> | string,
    value?: ?any): T;
  declare export function setWith<T>(
    object: T,
    path?: ?Array<string> | string,
    value: any,
    customizer?: (nsValue: any, key: string, nsObject: T) => any
  ): Object;
  declare export function setWith<T: void | null>(
    object: T,
    path?: ?Array<string> | string,
    value?: ?any,
    customizer?: ?(nsValue: any, key: string, nsObject: T) => any
  ): T;
  declare export function toPairs(object?: ?Object | Array<*>): Array<[string, any]>;
  declare export function toPairsIn(object?: ?Object): Array<[string, any]>;
  declare export function transform(
    collection: Object | $ReadOnlyArray<any>,
    iteratee?: ?OIteratee<*>,
    accumulator?: any
  ): any;
  declare export function transform(
    collection: void | null,
    iteratee?: ?OIteratee<*>,
    accumulator?: ?any
  ): {};
  declare export function unset(object: Object, path?: ?Array<string> | ?string): boolean;
  declare export function unset(object: void | null, path?: ?Array<string> | ?string): true;
  declare export function update(object: Object, path: string[] | string, updater: Function): Object;
  declare export function update<T: void | null>(
    object: T,
    path?: ?string[] | ?string,
    updater?: ?Function): T;
  declare export function updateWith(
    object: Object,
    path?: ?string[] | ?string,
    updater?: ?Function,
    customizer?: ?Function,
  ): Object;
  declare export function updateWith<T: void | null>(
    object: T,
    path?: ?string[] | ?string,
    updater?: ?Function,
    customizer?: ?Function,
  ): T;
  declare export function values(object?: ?Object): Array<any>;
  declare export function valuesIn(object?: ?Object): Array<any>;

  // Seq
  declare export function chain<T>(value: T): any;
  declare export function tap<T>(value: T, interceptor: (value: T) => any): T;
  declare export function thru<T1, T2>(value: T1, interceptor: (value: T1) => T2): T2;

  // String
  declare export function camelCase(string: string): string;
  declare export function camelCase(string: void | null): '';
  declare export function capitalize(string: string): string;
  declare export function capitalize(string: void | null): '';
  declare export function deburr(string: string): string;
  declare export function deburr(string: void | null): '';
  declare export function endsWith(string: string, target?: string, position?: ?number): boolean;
  declare export function endsWith(string: void | null, target?: ?string, position?: ?number): false;
  declare export function escape(string: string): string;
  declare export function escape(string: void | null): '';
  declare export function escapeRegExp(string: string): string;
  declare export function escapeRegExp(string: void | null): '';
  declare export function kebabCase(string: string): string;
  declare export function kebabCase(string: void | null): '';
  declare export function lowerCase(string: string): string;
  declare export function lowerCase(string: void | null): '';
  declare export function lowerFirst(string: string): string;
  declare export function lowerFirst(string: void | null): '';
  declare export function pad(string?: ?string, length?: ?number, chars?: ?string): string;
  declare export function padEnd(string?: ?string, length?: ?number, chars?: ?string): string;
  declare export function padStart(string?: ?string, length?: ?number, chars?: ?string): string;
  declare export function parseInt(string: string, radix?: ?number): number;
  declare export function repeat(string: string, n?: ?number): string;
  declare export function repeat(string: void | null, n?: ?number): '';
  declare export function replace(
    string: string,
    pattern: RegExp | string,
    replacement: ((string: string) => string) | string
  ): string;
  declare export function replace(
    string: void | null,
    pattern?: ?RegExp | ?string,
    replacement: ?((string: string) => string) | ?string
  ): '';
  declare export function snakeCase(string: string): string;
  declare export function snakeCase(string: void | null): '';
  declare export function split(
    string?: ?string,
    separator?: ?RegExp | ?string,
    limit?: ?number
  ): Array<string>;
  declare export function startCase(string: string): string;
  declare export function startCase(string: void | null): '';
  declare export function startsWith(string: string, target?: string, position?: number): boolean;
  declare export function startsWith(string: void | null, target?: ?string, position?: ?number): false;
  declare export function template(string?: ?string, options?: ?TemplateSettings): Function;
  declare export function toLower(string: string): string;
  declare export function toLower(string: void | null): '';
  declare export function toUpper(string: string): string;
  declare export function toUpper(string: void | null): '';
  declare export function trim(string: string, chars?: string): string;
  declare export function trim(string: void | null, chars?: ?string): '';
  declare export function trimEnd(string: string, chars?: ?string): string;
  declare export function trimEnd(string: void | null, chars?: ?string): '';
  declare export function trimStart(string: string, chars?: ?string): string;
  declare export function trimStart(string: void | null, chars?: ?string): '';
  declare export function truncate(string: string, options?: TruncateOptions): string;
  declare export function truncate(string: void | null, options?: ?TruncateOptions): '';
  declare export function unescape(string: string): string;
  declare export function unescape(string: void | null): '';
  declare export function upperCase(string: string): string;
  declare export function upperCase(string: void | null): '';
  declare export function upperFirst(string: string): string;
  declare export function upperFirst(string: void | null): '';
  declare export function words(string?: ?string, pattern?: ?RegExp | ?string): Array<string>;

  // Util
  declare export function attempt(func: Function, ...args: Array<any>): any;
  declare export function bindAll(object: Object, methodNames?: ?Array<string>): Object;
  declare export function bindAll<T: void | null>(object: T, methodNames?: ?Array<string>): T;
  declare export function bindAll(object: Object, ...methodNames: Array<string>): Object;
  declare export function cond(pairs?: ?NestedArray<Function>): Function;
  declare export function conforms(source?: ?Object): Function;
  declare export function constant<T>(value: T): () => T;
  declare export function defaultTo<T1: string | boolean | Object, T2>(
    value: T1,
    defaultValue: T2,
  ): T1;
  declare export function defaultTo<T1: number, T2>(value: T1, defaultValue: T2): T1 | T2;
  declare export function defaultTo<T1: void | null, T2>(value: T1, defaultValue: T2): T2;
  declare export var flow: ($ComposeReverse & (funcs: Array<Function>) => Function);
  declare export var flowRight: ($Compose & (funcs: Array<Function>) => Function);
  declare export function identity<T>(value: T): T;
  declare export function iteratee(func?: any): Function;
  declare export function matches(source?: ?Object): Function;
  declare export function matchesProperty(path?: ?Array<string> | string, srcValue: any): Function;
  declare export function method(path?: ?Array<string> | string, ...args?: Array<any>): Function;
  declare export function methodOf(object?: ?Object, ...args?: Array<any>): Function;
  declare export function mixin<T: Function | Object>(
    object?: T,
    source: Object,
    options?: { chain: boolean }
  ): T;
  declare export function noop(...args: Array<mixed>): void;
  declare export function nthArg(n?: ?number): Function;
  declare export function over(...iteratees: Array<Function>): Function;
  declare export function over(iteratees: Array<Function>): Function;
  declare export function overEvery(...predicates: Array<Function>): Function;
  declare export function overEvery(predicates: Array<Function>): Function;
  declare export function overSome(...predicates: Array<Function>): Function;
  declare export function overSome(predicates: Array<Function>): Function;
  declare export function property(path?: ?Array<string> | string): Function;
  declare export function propertyOf(object?: ?Object): Function;
  declare export function range(start: number, end: number, step?: number): Array<number>;
  declare export function range(end: number, step?: number): Array<number>;
  declare export function rangeRight(start?: ?number, end?: ?number, step?: ?number): Array<number>;
  declare export function rangeRight(end?: ?number, step?: ?number): Array<number>;
  declare export function runInContext(context?: ?Object): Function;

  declare export function stubArray(): Array<*>;
  declare export function stubFalse(): false;
  declare export function stubObject(): {};
  declare export function stubString(): "";
  declare export function stubTrue(): true;
  declare export function times(n?: ?number, ...rest?: Array<void | null>): Array<number>;
  declare export function times<T>(n: number, iteratee: (i: number) => T): Array<T>;
  declare export function toPath(value: any): Array<string>;
  declare export function uniqueId(prefix?: ?string): string;
}
