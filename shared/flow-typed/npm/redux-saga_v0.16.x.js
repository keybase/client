// flow-typed signature: d6d868868c26bb67334ba496927d4a48
// flow-typed version: 4940ac8b5a/redux-saga_v0.16.x/flow_>=v0.56.0

// @flow

declare module "redux-saga" {
  import typeof * as _effects from "redux-saga/effects";
  declare export var effects: _effects;

  declare export interface Channel {
    take: (cb: (msg: mixed) => void) => void;
    put: (msg: mixed) => void;
    flush: (cb: (msgs: mixed) => void) => void;
    close: () => void;
  }

  declare export interface Task<T> {
    isRunning: () => boolean;
    isCancelled: () => boolean;
    result: () => T | void;
    error: () => Error | void;
    cancel: () => void;
    done: Promise<T>;
  }

  declare export interface Buffer {
    isEmpty: () => boolean;
    put: (msg: mixed) => void;
    take(): mixed;
  }

  declare export interface SagaMonitor {
    effectTriggered: (options: {
      +effectId: number,
      +parentEffectId: number,
      +label: string,
      +effect: Effect
    }) => void;
    effectResolved: (effectId: number, result: mixed) => void;
    effectRejected: (effectId: number, error: Error) => void;
    effectCancelled: (effectId: number) => void;
    actionDispatched: (action: mixed) => void;
  }

  declare export type Saga<T> = Generator<Effect, T, any>;

  declare export var eventChannel: (
    sub: (emit: (msg: any) => void) => () => void,
    buffer?: Buffer,
    matcher?: (msg: mixed) => boolean
  ) => Channel;

  declare export var buffers: {
    +none: () => Buffer,
    +fixed: (limit?: number) => Buffer,
    +dropping: (limit?: number) => Buffer,
    +sliding: (limit?: number) => Buffer,
    +expanding: (initialSize?: number) => Buffer
  };

  declare export var channel: (buffer?: Buffer) => Channel;
  declare export var END: { +type: "@@redux-saga/CHANNEL_END" };
  declare export var CANCEL: Symbol;
  declare export var delay: (timeout: number) => Promise<void>;

  declare type RunSagaOptions = {
    +subscribe?: (emit: (input: any) => any) => () => void,
    +dispatch?: (output: any) => any,
    +getState?: () => any,
    +sagaMonitor?: SagaMonitor,
    +logger?: (
      level: "info" | "warning" | "error",
      ...args: Array<any>
    ) => void,
    +onError?: (error: Error) => void
  };

  declare export var runSaga: {
    <R, Fn: () => Saga<R>>(options: RunSagaOptions, saga: Fn): Task<R>,
    <R, T1, Fn: (t1: T1) => Saga<R>>(
      options: RunSagaOptions,
      saga: Fn,
      t1: T1
    ): Task<R>,
    <R, T1, T2, Fn: (t1: T1, t2: T2) => Saga<R>>(
      options: RunSagaOptions,
      saga: Fn,
      t1: T1,
      t2: T2
    ): Task<R>,
    <R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3) => Saga<R>>(
      options: RunSagaOptions,
      saga: Fn,
      t1: T1,
      t2: T2,
      t3: T3
    ): Task<R>,
    <R, T1, T2, T3, T4, Fn: (t1: T1, t2: T2, t3: T3, t4: T4) => Saga<R>>(
      options: RunSagaOptions,
      saga: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): Task<R>,
    <
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => Saga<R>
    >(
      options: RunSagaOptions,
      saga: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): Task<R>,
    <
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => Saga<R>
    >(
      options: RunSagaOptions,
      saga: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): Task<R>
  };

  declare interface SagaMiddleware {
    // TODO: This should be aligned with the official redux typings sometime
    (api: any): (next: any) => any;
    run: {
      <R, Fn: () => Saga<R>>(saga: Fn): Task<R>,
      <R, T1, Fn: (t1: T1) => Saga<R>>(saga: Fn, t1: T1): Task<R>,
      <R, T1, T2, Fn: (t1: T1, t2: T2) => Saga<R>>(
        saga: Fn,
        t1: T1,
        t2: T2
      ): Task<R>,
      <R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3) => Saga<R>>(
        saga: Fn,
        t1: T1,
        t2: T2,
        t3: T3
      ): Task<R>,
      <R, T1, T2, T3, T4, Fn: (t1: T1, t2: T2, t3: T3, t4: T4) => Saga<R>>(
        saga: Fn,
        t1: T1,
        t2: T2,
        t3: T3,
        t4: T4
      ): Task<R>,
      <
        R,
        T1,
        T2,
        T3,
        T4,
        T5,
        Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => Saga<R>
      >(
        saga: Fn,
        t1: T1,
        t2: T2,
        t3: T3,
        t4: T4,
        t5: T5
      ): Task<R>,
      <
        R,
        T1,
        T2,
        T3,
        T4,
        T5,
        T6,
        Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => Saga<R>
      >(
        saga: Fn,
        t1: T1,
        t2: T2,
        t3: T3,
        t4: T4,
        t5: T5,
        t6: T6
      ): Task<R>
    };
  }

  declare type createSagaMiddleware = (options?: {
    +sagaMonitor?: SagaMonitor,
    +logger?: (
      level: "info" | "warning" | "error",
      ...args: Array<any>
    ) => void,
    +onError?: (error: Error) => void
  }) => SagaMiddleware;

  declare export default createSagaMiddleware

  // Effect types
  declare export type PatternPart = string | (any => boolean);
  declare export type Pattern = PatternPart | $ReadOnlyArray<PatternPart>;

  declare export type TakeEffect<
    P: Pattern | void,
    C: Channel | void,
    M: true | void
  > = {
    +"@@redux-saga/IO": true,
    +TAKE: {
      +pattern: P,
      +channel: C,
      +maybe: M
    }
  };

  declare export type PutEffect<A: Object, C: Channel | null> = {
    +"@@redux-saga/IO": true,
    +PUT: {
      +action: A,
      +channel: C
    }
  };

  declare export type CallEffect<Ctx, Fn: Function, Args: $ReadOnlyArray<*>> = {
    +"@@redux-saga/IO": true,
    +CALL: {
      +context: Ctx,
      +fn: Fn,
      +args: Args
    }
  };

  declare export type ForkEffect<Ctx, Fn: Function, Args: $ReadOnlyArray<*>> = {
    +"@@redux-saga/IO": true,
    +FORK: {
      +context: Ctx,
      +fn: Fn,
      +args: Args
    }
  };

  declare export type CpsEffect<Ctx, Fn: Function, Args: $ReadOnlyArray<*>> = {
    +"@@redux-saga/IO": true,
    +CPS: {
      +context: Ctx,
      +fn: Fn,
      +args: Args
    }
  };

  declare export type SpawnEffect<
    Ctx,
    Fn: Function,
    Args: $ReadOnlyArray<*>
  > = {
    +"@@redux-saga/IO": true,
    +SPAWN: {
      +context: Ctx,
      +fn: Fn,
      +args: Args
    }
  };

  declare export type JoinEffect<T: Task<*>> = {
    +"@@redux-saga/IO": true,
    +JOIN: T
  };

  declare export type CancelEffect<
    T: Task<*> | "@@redux-saga/SELF_CANCELLATION"
  > = {
    +"@@redux-saga/IO": true,
    +CANCEL: T
  };

  declare export type SelectEffect<Fn: Function | void, Args: $ReadOnlyArray<*>> = {
    +"@@redux-saga/IO": true,
    +SELECT: {
      +selector: Fn,
      +args: Args
    }
  };

  declare export type ActionChannelEffect<P: Pattern, B: Buffer | void> = {
    +"@@redux-saga/IO": true,
    +ACTION_CHANNEL: {
      +buffer: B,
      +pattern: P
    }
  };

  declare export type FlushEffect = {
    +"@@redux-saga/IO": true,
    +FLUSH: Channel
  };

  declare export type CancelledEffect = {
    +"@@redux-saga/IO": true,
    +CANCELLED: {}
  };

  declare export type SetContextEffect<T: {}> = {
    +"@@redux-saga/IO": true,
    +SET_CONTEXT: T
  };

  declare export type GetContextEffect = {
    +"@@redux-saga/IO": true,
    +GET_CONTEXT: string
  };

  declare export type RaceEffect<
    R: { +[name: string]: Effect } | $ReadOnlyArray<Effect>
  > = {
    +"@@redux-saga/IO": true,
    +RACE: R
  };

  declare export type AllEffect = {
    +"@@redux-saga/IO": true,
    +ALL: { +[name: string]: Effect } | $ReadOnlyArray<Effect>
  };

  declare export type Effect =
    | TakeEffect<*, *, *>
    | PutEffect<*, *>
    | CallEffect<*, *, *>
    | ForkEffect<*, *, *>
    | CpsEffect<*, *, *>
    | SpawnEffect<*, *, *>
    | JoinEffect<*>
    | CancelEffect<*>
    | SelectEffect<*, *>
    | ActionChannelEffect<*, *>
    | FlushEffect
    | CancelledEffect
    | SetContextEffect<*>
    | GetContextEffect
    | RaceEffect<*>
    | AllEffect;
}

declare module "redux-saga/effects" {
  import type {
    ActionChannelEffect,
    AllEffect,
    Buffer,
    CallEffect,
    CancelEffect,
    CancelledEffect,
    Channel,
    CpsEffect,
    Effect,
    FlushEffect,
    ForkEffect,
    GetContextEffect,
    JoinEffect,
    Pattern,
    PutEffect,
    RaceEffect,
    Saga,
    SelectEffect,
    SetContextEffect,
    SpawnEffect,
    TakeEffect,
    Task
  } from "redux-saga";

  declare export var take: {
    <P: Pattern>(pattern: P): TakeEffect<P, void, void>,
    (channel: Channel): TakeEffect<void, Channel, void>,
    +maybe: {
      <P: Pattern>(pattern: P): TakeEffect<P, void, true>,
      (channel: Channel): TakeEffect<void, Channel, true>
    }
  };

  declare export var put: {
    <A: Object>(action: A): PutEffect<A, null>,
    <A: Object>(channel: Channel, action: A): PutEffect<A, Channel>,
    resolve: {
      <A: Object>(action: A): PutEffect<A, null>,
      <A: Object>(channel: Channel, action: A): PutEffect<A, Channel>,
    }
  };

  declare export var call: {
    // normal calls
    <R, Fn: () => R>(fn: Fn): CallEffect<null, Fn, []>,
    <R, T1, Fn: (t1: T1) => R>(fn: Fn, t1: T1): CallEffect<null, Fn, [T1]>,
    <R, T1, T2, Fn: (t1: T1, t2: T2) => R>(
      fn: Fn,
      t1: T1,
      t2: T2
    ): CallEffect<null, Fn, [T1, T2]>,
    <R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3) => R>(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3
    ): CallEffect<null, Fn, [T1, T2, T3]>,
    <R, T1, T2, T3, T4, Fn: (t1: T1, t2: T2, t3: T3, t4: T4) => R>(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): CallEffect<null, Fn, [T1, T2, T3, T4]>,
    <R, T1, T2, T3, T4, T5, Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R>(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): CallEffect<null, Fn, [T1, T2, T3, T4, T5]>,
    <
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => R
    >(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): CallEffect<null, Fn, [T1, T2, T3, T4, T5, T6]>,

    // with context
    <Ctx, R, Fn: () => R>(cfn: [Ctx, Fn]): CallEffect<Ctx, Fn, []>,
    <Ctx, R, T1, Fn: (t1: T1) => R>(
      cfn: [Ctx, Fn],
      t1: T1
    ): CallEffect<Ctx, Fn, [T1]>,
    <Ctx, R, T1, T2, Fn: (t1: T1, t2: T2) => R>(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2
    ): CallEffect<Ctx, Fn, [T1, T2]>,
    <Ctx, R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3) => R>(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3
    ): CallEffect<Ctx, Fn, [T1, T2, T3]>,
    <Ctx, R, T1, T2, T3, T4, Fn: (t1: T1, t2: T2, t3: T3, t4: T4) => R>(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): CallEffect<Ctx, Fn, [T1, T2, T3, T4]>,
    <
      Ctx,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R
    >(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): CallEffect<Ctx, Fn, [T1, T2, T3, T4, T5]>,
    <
      Ctx,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => R
    >(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): CallEffect<Ctx, Fn, [T1, T2, T3, T4, T5, T6]>
  };

  declare export var apply: {
    <Ctx, R, Fn: () => R>(ctx: Ctx, fn: Fn): CallEffect<Ctx, Fn, []>,
    <Ctx, R, T1, Fn: (t1: T1) => R>(
      ctx: Ctx,
      fn: Fn,
      t1: T1
    ): CallEffect<Ctx, Fn, [T1]>,
    <Ctx, R, T1, T2, Fn: (t1: T1, t2: T2) => R>(
      ctx: Ctx,
      fn: Fn,
      t1: T1,
      t2: T2
    ): CallEffect<Ctx, Fn, [T1, T2]>,
    <Ctx, R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3) => R>(
      ctx: Ctx,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3
    ): CallEffect<Ctx, Fn, [T1, T2, T3]>,
    <Ctx, R, T1, T2, T3, T4, Fn: (t1: T1, t2: T2, t3: T3, t4: T4) => R>(
      ctx: Ctx,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): CallEffect<Ctx, Fn, [T1, T2, T3, T4]>,
    <
      Ctx,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R
    >(
      ctx: Ctx,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): CallEffect<Ctx, Fn, [T1, T2, T3, T4, T5]>,
    <
      Ctx,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => R
    >(
      ctx: Ctx,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): CallEffect<Ctx, Fn, [T1, T2, T3, T4, T5, T6]>
  };

  declare type NodeCallback<R> = {
    (err: Error): void,
    (err: null | void | false, result: R): void
  };

  declare export var cps: {
    // normal calls
    <R, Fn: (cb: NodeCallback<R>) => void>(fn: Fn): CpsEffect<null, Fn, []>,
    <R, T1, Fn: (t1: T1, cb: NodeCallback<R>) => void>(
      fn: Fn,
      t1: T1
    ): CpsEffect<null, Fn, [T1]>,
    <R, T1, T2, Fn: (t1: T1, t2: T2, cb: NodeCallback<R>) => void>(
      fn: Fn,
      t1: T1,
      t2: T2
    ): CpsEffect<null, Fn, [T1, T2]>,
    <R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3, cb: NodeCallback<R>) => void>(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3
    ): CpsEffect<null, Fn, [T1, T2, T3]>,
    <
      R,
      T1,
      T2,
      T3,
      T4,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, cb: NodeCallback<R>) => void
    >(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): CpsEffect<null, Fn, [T1, T2, T3, T4]>,
    <
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, cb: NodeCallback<R>) => void
    >(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): CpsEffect<null, Fn, [T1, T2, T3, T4, T5]>,
    <
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (
        t1: T1,
        t2: T2,
        t3: T3,
        t4: T4,
        t5: T5,
        t6: T6,
        cb: NodeCallback<R>
      ) => void
    >(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): CpsEffect<null, Fn, [T1, T2, T3, T4, T5, T6]>,

    // with context
    <Ctx, R, Fn: (cb: NodeCallback<R>) => void>(
      cfn: [Ctx, Fn]
    ): CpsEffect<Ctx, Fn, []>,
    <Ctx, R, T1, Fn: (t1: T1, cb: NodeCallback<R>) => void>(
      cfn: [Ctx, Fn],
      t1: T1
    ): CpsEffect<Ctx, Fn, [T1]>,
    <Ctx, R, T1, T2, Fn: (t1: T1, t2: T2, cb: NodeCallback<R>) => void>(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2
    ): CpsEffect<Ctx, Fn, [T1, T2]>,
    <
      Ctx,
      R,
      T1,
      T2,
      T3,
      Fn: (t1: T1, t2: T2, t3: T3, cb: NodeCallback<R>) => void
    >(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3
    ): CpsEffect<Ctx, Fn, [T1, T2, T3]>,
    <
      Ctx,
      R,
      T1,
      T2,
      T3,
      T4,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, cb: NodeCallback<R>) => void
    >(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): CpsEffect<Ctx, Fn, [T1, T2, T3, T4]>,
    <
      Ctx,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, cb: NodeCallback<R>) => void
    >(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): CpsEffect<Ctx, Fn, [T1, T2, T3, T4, T5]>,
    <
      Ctx,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (
        t1: T1,
        t2: T2,
        t3: T3,
        t4: T4,
        t5: T5,
        t6: T6,
        cb: NodeCallback<R>
      ) => void
    >(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): CpsEffect<Ctx, Fn, [T1, T2, T3, T4, T5, T6]>
  };

  declare export var fork: {
    // normal calls
    <R, Fn: () => R>(fn: Fn): ForkEffect<null, Fn, []>,
    <R, T1, Fn: (t1: T1) => R>(fn: Fn, t1: T1): ForkEffect<null, Fn, [T1]>,
    <R, T1, T2, Fn: (t1: T1, t2: T2) => R>(
      fn: Fn,
      t1: T1,
      t2: T2
    ): ForkEffect<null, Fn, [T1, T2]>,
    <R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3) => R>(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3
    ): ForkEffect<null, Fn, [T1, T2, T3]>,
    <R, T1, T2, T3, T4, Fn: (t1: T1, t2: T2, t3: T3, t4: T4) => R>(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): ForkEffect<null, Fn, [T1, T2, T3, T4]>,
    <R, T1, T2, T3, T4, T5, Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R>(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): ForkEffect<null, Fn, [T1, T2, T3, T4, T5]>,
    <
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => R
    >(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): ForkEffect<null, Fn, [T1, T2, T3, T4, T5, T6]>,

    // with context
    <Ctx, R, Fn: () => R>(cfn: [Ctx, Fn]): ForkEffect<Ctx, Fn, []>,
    <Ctx, R, T1, Fn: (t1: T1) => R>(
      cfn: [Ctx, Fn],
      t1: T1
    ): ForkEffect<Ctx, Fn, [T1]>,
    <Ctx, R, T1, T2, Fn: (t1: T1, t2: T2) => R>(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2
    ): ForkEffect<Ctx, Fn, [T1, T2]>,
    <Ctx, R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3) => R>(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3
    ): ForkEffect<Ctx, Fn, [T1, T2, T3]>,
    <Ctx, R, T1, T2, T3, T4, Fn: (t1: T1, t2: T2, t3: T3, t4: T4) => R>(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): ForkEffect<Ctx, Fn, [T1, T2, T3, T4]>,
    <
      Ctx,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R
    >(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): ForkEffect<Ctx, Fn, [T1, T2, T3, T4, T5]>,
    <
      Ctx,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => R
    >(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): ForkEffect<Ctx, Fn, [T1, T2, T3, T4, T5, T6]>
  };

  declare export var spawn: {
    // normal calls
    <R, Fn: () => R>(fn: Fn): SpawnEffect<null, Fn, []>,
    <R, T1, Fn: (t1: T1) => R>(fn: Fn, t1: T1): SpawnEffect<null, Fn, [T1]>,
    <R, T1, T2, Fn: (t1: T1, t2: T2) => R>(
      fn: Fn,
      t1: T1,
      t2: T2
    ): SpawnEffect<null, Fn, [T1, T2]>,
    <R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3) => R>(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3
    ): SpawnEffect<null, Fn, [T1, T2, T3]>,
    <R, T1, T2, T3, T4, Fn: (t1: T1, t2: T2, t3: T3, t4: T4) => R>(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): SpawnEffect<null, Fn, [T1, T2, T3, T4]>,
    <R, T1, T2, T3, T4, T5, Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R>(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): SpawnEffect<null, Fn, [T1, T2, T3, T4, T5]>,
    <
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => R
    >(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): SpawnEffect<null, Fn, [T1, T2, T3, T4, T5, T6]>,

    // with context
    <Ctx, R, Fn: () => R>(cfn: [Ctx, Fn]): SpawnEffect<Ctx, Fn, []>,
    <Ctx, R, T1, Fn: (t1: T1) => R>(
      cfn: [Ctx, Fn],
      t1: T1
    ): SpawnEffect<Ctx, Fn, [T1]>,
    <Ctx, R, T1, T2, Fn: (t1: T1, t2: T2) => R>(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2
    ): SpawnEffect<Ctx, Fn, [T1, T2]>,
    <Ctx, R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3) => R>(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3
    ): SpawnEffect<Ctx, Fn, [T1, T2, T3]>,
    <Ctx, R, T1, T2, T3, T4, Fn: (t1: T1, t2: T2, t3: T3, t4: T4) => R>(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): SpawnEffect<Ctx, Fn, [T1, T2, T3, T4]>,
    <
      Ctx,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R
    >(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): SpawnEffect<Ctx, Fn, [T1, T2, T3, T4, T5]>,
    <
      Ctx,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => R
    >(
      cfn: [Ctx, Fn],
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): SpawnEffect<Ctx, Fn, [T1, T2, T3, T4, T5, T6]>
  };

  declare export var join: {
    <T: Task<*>>(task: T): JoinEffect<T>,
    (task: Task<*>, ...tasks: $ReadOnlyArray<Task<any>>): AllEffect
  };

  declare export var cancel: {
    (): CancelEffect<"@@redux-saga/SELF_CANCELLATION">,
    <T: Task<*>>(task: T): CancelEffect<T>,
    (task: Task<*>, ...tasks: $ReadOnlyArray<Task<any>>): AllEffect
  };

  declare export var select: {
    (): SelectEffect<void, []>,
    <S, R, Fn: (state: S) => R>(fn: Fn): SelectEffect<Fn, []>,
    <S, R, T1, Fn: (state: S, t1: T1) => R>(
      fn: Fn,
      t1: T1
    ): SelectEffect<Fn, [T1]>,
    <S, R, T1, T2, Fn: (state: S, t1: T1, t2: T2) => R>(
      fn: Fn,
      t1: T1,
      t2: T2
    ): SelectEffect<Fn, [T1, T2]>,
    <S, R, T1, T2, T3, Fn: (state: S, t1: T1, t2: T2, t3: T3) => R>(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3
    ): SelectEffect<Fn, [T1, T2, T3]>,
    <S, R, T1, T2, T3, T4, Fn: (state: S, t1: T1, t2: T2, t3: T3, t4: T4) => R>(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): SelectEffect<Fn, [T1, T2, T3, T4]>,
    <
      S,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      Fn: (state: S, t1: T1, t2: T2, t3: T3, t4: T4, t5: T5) => R
    >(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): SelectEffect<Fn, [T1, T2, T3, T4, T5]>,
    <
      S,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (state: S, t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6) => R
    >(
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): SelectEffect<Fn, [T1, T2, T3, T4, T5, T6]>
  };

  declare export var actionChannel: {
    <P: Pattern>(pattern: P): ActionChannelEffect<P, void>,
    <P: Pattern, B: Buffer>(pattern: P, buffer: B): ActionChannelEffect<P, B>
  };

  declare export var flush: {
    (channel: Channel): FlushEffect
  };

  declare export var cancelled: {
    (): CancelledEffect
  };

  declare export var setContext: {
    <T>(ctx: T): SetContextEffect<T>
  };

  declare export var getContext: {
    (prop: string): GetContextEffect
  };

  declare export var race: {
    <R: { +[name: string]: Effect } | $ReadOnlyArray<Effect>>(
      effects: R
    ): RaceEffect<R>
  };

  declare export var all: {
    (effects: { +[name: string]: Effect }): AllEffect,
    (effects: $ReadOnlyArray<Effect>): AllEffect
  };

  declare export var takeEvery: {
    // normal calls
    <A, R, Fn: (action: A) => Saga<R>>(
      pattern: Pattern,
      fn: Fn
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <A, R, T1, Fn: (t1: T1, action: A) => Saga<R>>(
      pattern: Pattern,
      fn: Fn,
      t1: T1
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <A, R, T1, T2, Fn: (t1: T1, t2: T2, action: A) => Saga<R>>(
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <A, R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3, action: A) => Saga<R>>(
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, action: A) => Saga<R>
    >(
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, action: A) => Saga<R>
    >(
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6, action: A) => Saga<R>
    >(
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,

    // with channel
    <A, R, Fn: (action: A) => Saga<R>>(
      channel: Channel,
      fn: Fn
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <A, R, T1, Fn: (t1: T1, action: A) => Saga<R>>(
      channel: Channel,
      fn: Fn,
      t1: T1
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <A, R, T1, T2, Fn: (t1: T1, t2: T2, action: A) => Saga<R>>(
      channel: Channel,
      fn: Fn,
      t1: T1,
      t2: T2
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <A, R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3, action: A) => Saga<R>>(
      channel: Channel,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, action: A) => Saga<R>
    >(
      channel: Channel,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, action: A) => Saga<R>
    >(
      channel: Channel,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6, action: A) => Saga<R>
    >(
      channel: Channel,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>
  };

  declare export var takeLatest: {
    // normal calls
    <A, R, Fn: (action: A) => Saga<R>>(
      pattern: Pattern,
      fn: Fn
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <A, R, T1, Fn: (t1: T1, action: A) => Saga<R>>(
      pattern: Pattern,
      fn: Fn,
      t1: T1
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <A, R, T1, T2, Fn: (t1: T1, t2: T2, action: A) => Saga<R>>(
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <A, R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3, action: A) => Saga<R>>(
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, action: A) => Saga<R>
    >(
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, action: A) => Saga<R>
    >(
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6, action: A) => Saga<R>
    >(
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,

    // with channel
    <A, R, Fn: (action: A) => Saga<R>>(
      channel: Channel,
      fn: Fn
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <A, R, T1, Fn: (t1: T1, action: A) => Saga<R>>(
      channel: Channel,
      fn: Fn,
      t1: T1
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <A, R, T1, T2, Fn: (t1: T1, t2: T2, action: A) => Saga<R>>(
      channel: Channel,
      fn: Fn,
      t1: T1,
      t2: T2
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <A, R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3, action: A) => Saga<R>>(
      channel: Channel,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, action: A) => Saga<R>
    >(
      channel: Channel,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, action: A) => Saga<R>
    >(
      channel: Channel,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6, action: A) => Saga<R>
    >(
      channel: Channel,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): ForkEffect<null, Function, $ReadOnlyArray<any>>
  };

  declare export var throttle: {
    // normal calls
    <A, R, Fn: (action: A) => Saga<R>>(
      ms: number,
      pattern: Pattern,
      fn: Fn
    ): ForkEffect<null, Function, []>,
    <A, R, T1, Fn: (t1: T1, action: A) => Saga<R>>(
      ms: number,
      pattern: Pattern,
      fn: Fn,
      t1: T1
    ): ForkEffect<null, Function, [T1]>,
    <A, R, T1, T2, Fn: (t1: T1, t2: T2, action: A) => Saga<R>>(
      ms: number,
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2
    ): ForkEffect<null, Function, [T1, T2]>,
    <A, R, T1, T2, T3, Fn: (t1: T1, t2: T2, t3: T3, action: A) => Saga<R>>(
      ms: number,
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3
    ): ForkEffect<null, Function, [T1, T2, T3]>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, action: A) => Saga<R>
    >(
      ms: number,
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4
    ): ForkEffect<null, Function, [T1, T2, T3, T4]>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, action: A) => Saga<R>
    >(
      ms: number,
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5
    ): ForkEffect<null, Function, [T1, T2, T3, T4, T5]>,
    <
      A,
      R,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      Fn: (t1: T1, t2: T2, t3: T3, t4: T4, t5: T5, t6: T6, action: A) => Saga<R>
    >(
      ms: number,
      pattern: Pattern,
      fn: Fn,
      t1: T1,
      t2: T2,
      t3: T3,
      t4: T4,
      t5: T5,
      t6: T6
    ): ForkEffect<null, Function, [T1, T2, T3, T4, T5, T6]>
  };
}
