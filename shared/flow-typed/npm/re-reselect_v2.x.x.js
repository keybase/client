// flow-typed signature: 0ee374db4bf3c9680d576ab329880e2e
// flow-typed version: b36167a3c9/re-reselect_v2.x.x/flow_>=v0.67.1

type ExtractReturnType = <Return>((...rest: any[]) => Return) => Return;

// S - State
// P - Params
// R - Return

declare module 're-reselect' {
  declare type Selector<S, R> = (state: S) => R;
  declare type Resolver<S> = (state: S, ...args: any[]) => any;

  // begin copy-paste from reselect libdef. the future is now.
  declare type InputSelector<-TState, TProps, TResult> =
    (state: TState, props: TProps, ...rest: any[]) => TResult

  declare type OutputSelector<-TState, TProps, TResult> =
    & InputSelector<TState, TProps, TResult>
    & {
      recomputations(): number,
      resetRecomputations(): void,
      resultFunc(state: TState, props: TProps, ...rest: Array<any>): TResult,
    };

  declare type CreateSelectorInstance = {
    <TState, TProps, TResult, T1>(
      selector1: InputSelector<TState, TProps, T1>,
      resultFunc: (arg1: T1) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <TState, TProps, TResult, T1>(
      selectors: [InputSelector<TState, TProps, T1>],
      resultFunc: (arg1: T1) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2>(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      resultFunc: (arg1: T1, arg2: T2) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2>(
      selectors: [InputSelector<TState, TProps, T1>, InputSelector<TState, TProps, T2>],
      resultFunc: (arg1: T1, arg2: T2) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3>(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      resultFunc: (arg1: T1, arg2: T2, arg3: T3) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3>(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>
      ],
      resultFunc: (arg1: T1, arg2: T2, arg3: T3) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4>(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      selector4: InputSelector<TState, TProps, T4>,
      resultFunc: (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4>(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>,
        InputSelector<TState, TProps, T4>
      ],
      resultFunc: (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5>(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      selector4: InputSelector<TState, TProps, T4>,
      selector5: InputSelector<TState, TProps, T5>,
      resultFunc: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5>(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>,
        InputSelector<TState, TProps, T4>,
        InputSelector<TState, TProps, T5>
      ],
      resultFunc: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6>(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      selector4: InputSelector<TState, TProps, T4>,
      selector5: InputSelector<TState, TProps, T5>,
      selector6: InputSelector<TState, TProps, T6>,
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6>(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>,
        InputSelector<TState, TProps, T4>,
        InputSelector<TState, TProps, T5>,
        InputSelector<TState, TProps, T6>
      ],
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7>(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      selector4: InputSelector<TState, TProps, T4>,
      selector5: InputSelector<TState, TProps, T5>,
      selector6: InputSelector<TState, TProps, T6>,
      selector7: InputSelector<TState, TProps, T7>,
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7>(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>,
        InputSelector<TState, TProps, T4>,
        InputSelector<TState, TProps, T5>,
        InputSelector<TState, TProps, T6>,
        InputSelector<TState, TProps, T7>
      ],
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8>(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      selector4: InputSelector<TState, TProps, T4>,
      selector5: InputSelector<TState, TProps, T5>,
      selector6: InputSelector<TState, TProps, T6>,
      selector7: InputSelector<TState, TProps, T7>,
      selector8: InputSelector<TState, TProps, T8>,
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8>(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>,
        InputSelector<TState, TProps, T4>,
        InputSelector<TState, TProps, T5>,
        InputSelector<TState, TProps, T6>,
        InputSelector<TState, TProps, T7>,
        InputSelector<TState, TProps, T8>
      ],
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8, T9>(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      selector4: InputSelector<TState, TProps, T4>,
      selector5: InputSelector<TState, TProps, T5>,
      selector6: InputSelector<TState, TProps, T6>,
      selector7: InputSelector<TState, TProps, T7>,
      selector8: InputSelector<TState, TProps, T8>,
      selector9: InputSelector<TState, TProps, T9>,
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8, T9>(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>,
        InputSelector<TState, TProps, T4>,
        InputSelector<TState, TProps, T5>,
        InputSelector<TState, TProps, T6>,
        InputSelector<TState, TProps, T7>,
        InputSelector<TState, TProps, T8>,
        InputSelector<TState, TProps, T9>
      ],
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      selector4: InputSelector<TState, TProps, T4>,
      selector5: InputSelector<TState, TProps, T5>,
      selector6: InputSelector<TState, TProps, T6>,
      selector7: InputSelector<TState, TProps, T7>,
      selector8: InputSelector<TState, TProps, T8>,
      selector9: InputSelector<TState, TProps, T9>,
      selector10: InputSelector<TState, TProps, T10>,
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>,
        InputSelector<TState, TProps, T4>,
        InputSelector<TState, TProps, T5>,
        InputSelector<TState, TProps, T6>,
        InputSelector<TState, TProps, T7>,
        InputSelector<TState, TProps, T8>,
        InputSelector<TState, TProps, T9>,
        InputSelector<TState, TProps, T10>
      ],
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      selector4: InputSelector<TState, TProps, T4>,
      selector5: InputSelector<TState, TProps, T5>,
      selector6: InputSelector<TState, TProps, T6>,
      selector7: InputSelector<TState, TProps, T7>,
      selector8: InputSelector<TState, TProps, T8>,
      selector9: InputSelector<TState, TProps, T9>,
      selector10: InputSelector<TState, TProps, T10>,
      selector11: InputSelector<TState, TProps, T11>,
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10,
        arg11: T11
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>,
        InputSelector<TState, TProps, T4>,
        InputSelector<TState, TProps, T5>,
        InputSelector<TState, TProps, T6>,
        InputSelector<TState, TProps, T7>,
        InputSelector<TState, TProps, T8>,
        InputSelector<TState, TProps, T9>,
        InputSelector<TState, TProps, T10>,
        InputSelector<TState, TProps, T11>
      ],
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10,
        arg11: T11
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <
      TState,
      TProps,
      TResult,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      T7,
      T8,
      T9,
      T10,
      T11,
      T12
    >(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      selector4: InputSelector<TState, TProps, T4>,
      selector5: InputSelector<TState, TProps, T5>,
      selector6: InputSelector<TState, TProps, T6>,
      selector7: InputSelector<TState, TProps, T7>,
      selector8: InputSelector<TState, TProps, T8>,
      selector9: InputSelector<TState, TProps, T9>,
      selector10: InputSelector<TState, TProps, T10>,
      selector11: InputSelector<TState, TProps, T11>,
      selector12: InputSelector<TState, TProps, T12>,
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10,
        arg11: T11,
        arg12: T12
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <
      TState,
      TProps,
      TResult,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      T7,
      T8,
      T9,
      T10,
      T11,
      T12
    >(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>,
        InputSelector<TState, TProps, T4>,
        InputSelector<TState, TProps, T5>,
        InputSelector<TState, TProps, T6>,
        InputSelector<TState, TProps, T7>,
        InputSelector<TState, TProps, T8>,
        InputSelector<TState, TProps, T9>,
        InputSelector<TState, TProps, T10>,
        InputSelector<TState, TProps, T11>,
        InputSelector<TState, TProps, T12>
      ],
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10,
        arg11: T11,
        arg12: T12
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <
      TState,
      TProps,
      TResult,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      T7,
      T8,
      T9,
      T10,
      T11,
      T12,
      T13
    >(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      selector4: InputSelector<TState, TProps, T4>,
      selector5: InputSelector<TState, TProps, T5>,
      selector6: InputSelector<TState, TProps, T6>,
      selector7: InputSelector<TState, TProps, T7>,
      selector8: InputSelector<TState, TProps, T8>,
      selector9: InputSelector<TState, TProps, T9>,
      selector10: InputSelector<TState, TProps, T10>,
      selector11: InputSelector<TState, TProps, T11>,
      selector12: InputSelector<TState, TProps, T12>,
      selector13: InputSelector<TState, TProps, T13>,
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10,
        arg11: T11,
        arg12: T12,
        arg13: T13
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <
      TState,
      TProps,
      TResult,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      T7,
      T8,
      T9,
      T10,
      T11,
      T12,
      T13
    >(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>,
        InputSelector<TState, TProps, T4>,
        InputSelector<TState, TProps, T5>,
        InputSelector<TState, TProps, T6>,
        InputSelector<TState, TProps, T7>,
        InputSelector<TState, TProps, T8>,
        InputSelector<TState, TProps, T9>,
        InputSelector<TState, TProps, T10>,
        InputSelector<TState, TProps, T11>,
        InputSelector<TState, TProps, T12>,
        InputSelector<TState, TProps, T13>
      ],
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10,
        arg11: T11,
        arg12: T12,
        arg13: T13
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <
      TState,
      TProps,
      TResult,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      T7,
      T8,
      T9,
      T10,
      T11,
      T12,
      T13,
      T14
    >(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      selector4: InputSelector<TState, TProps, T4>,
      selector5: InputSelector<TState, TProps, T5>,
      selector6: InputSelector<TState, TProps, T6>,
      selector7: InputSelector<TState, TProps, T7>,
      selector8: InputSelector<TState, TProps, T8>,
      selector9: InputSelector<TState, TProps, T9>,
      selector10: InputSelector<TState, TProps, T10>,
      selector11: InputSelector<TState, TProps, T11>,
      selector12: InputSelector<TState, TProps, T12>,
      selector13: InputSelector<TState, TProps, T13>,
      selector14: InputSelector<TState, TProps, T14>,
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10,
        arg11: T11,
        arg12: T12,
        arg13: T13,
        arg14: T14
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <
      TState,
      TProps,
      TResult,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      T7,
      T8,
      T9,
      T10,
      T11,
      T12,
      T13,
      T14
    >(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>,
        InputSelector<TState, TProps, T4>,
        InputSelector<TState, TProps, T5>,
        InputSelector<TState, TProps, T6>,
        InputSelector<TState, TProps, T7>,
        InputSelector<TState, TProps, T8>,
        InputSelector<TState, TProps, T9>,
        InputSelector<TState, TProps, T10>,
        InputSelector<TState, TProps, T11>,
        InputSelector<TState, TProps, T12>,
        InputSelector<TState, TProps, T13>,
        InputSelector<TState, TProps, T14>
      ],
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10,
        arg11: T11,
        arg12: T12,
        arg13: T13,
        arg14: T14
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <
      TState,
      TProps,
      TResult,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      T7,
      T8,
      T9,
      T10,
      T11,
      T12,
      T13,
      T14,
      T15
    >(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      selector4: InputSelector<TState, TProps, T4>,
      selector5: InputSelector<TState, TProps, T5>,
      selector6: InputSelector<TState, TProps, T6>,
      selector7: InputSelector<TState, TProps, T7>,
      selector8: InputSelector<TState, TProps, T8>,
      selector9: InputSelector<TState, TProps, T9>,
      selector10: InputSelector<TState, TProps, T10>,
      selector11: InputSelector<TState, TProps, T11>,
      selector12: InputSelector<TState, TProps, T12>,
      selector13: InputSelector<TState, TProps, T13>,
      selector14: InputSelector<TState, TProps, T14>,
      selector15: InputSelector<TState, TProps, T15>,
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10,
        arg11: T11,
        arg12: T12,
        arg13: T13,
        arg14: T14,
        arg15: T15
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <
      TState,
      TProps,
      TResult,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      T7,
      T8,
      T9,
      T10,
      T11,
      T12,
      T13,
      T14,
      T15
    >(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>,
        InputSelector<TState, TProps, T4>,
        InputSelector<TState, TProps, T5>,
        InputSelector<TState, TProps, T6>,
        InputSelector<TState, TProps, T7>,
        InputSelector<TState, TProps, T8>,
        InputSelector<TState, TProps, T9>,
        InputSelector<TState, TProps, T10>,
        InputSelector<TState, TProps, T11>,
        InputSelector<TState, TProps, T12>,
        InputSelector<TState, TProps, T13>,
        InputSelector<TState, TProps, T14>,
        InputSelector<TState, TProps, T15>
      ],
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10,
        arg11: T11,
        arg12: T12,
        arg13: T13,
        arg14: T14,
        arg15: T15
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,

    <
      TState,
      TProps,
      TResult,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      T7,
      T8,
      T9,
      T10,
      T11,
      T12,
      T13,
      T14,
      T15,
      T16
    >(
      selector1: InputSelector<TState, TProps, T1>,
      selector2: InputSelector<TState, TProps, T2>,
      selector3: InputSelector<TState, TProps, T3>,
      selector4: InputSelector<TState, TProps, T4>,
      selector5: InputSelector<TState, TProps, T5>,
      selector6: InputSelector<TState, TProps, T6>,
      selector7: InputSelector<TState, TProps, T7>,
      selector8: InputSelector<TState, TProps, T8>,
      selector9: InputSelector<TState, TProps, T9>,
      selector10: InputSelector<TState, TProps, T10>,
      selector11: InputSelector<TState, TProps, T11>,
      selector12: InputSelector<TState, TProps, T12>,
      selector13: InputSelector<TState, TProps, T13>,
      selector14: InputSelector<TState, TProps, T14>,
      selector15: InputSelector<TState, TProps, T15>,
      selector16: InputSelector<TState, TProps, T16>,
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10,
        arg11: T11,
        arg12: T12,
        arg13: T13,
        arg14: T14,
        arg15: T15,
        arg16: T16
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>,
    <
      TState,
      TProps,
      TResult,
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      T7,
      T8,
      T9,
      T10,
      T11,
      T12,
      T13,
      T14,
      T15,
      T16
    >(
      selectors: [
        InputSelector<TState, TProps, T1>,
        InputSelector<TState, TProps, T2>,
        InputSelector<TState, TProps, T3>,
        InputSelector<TState, TProps, T4>,
        InputSelector<TState, TProps, T5>,
        InputSelector<TState, TProps, T6>,
        InputSelector<TState, TProps, T7>,
        InputSelector<TState, TProps, T8>,
        InputSelector<TState, TProps, T9>,
        InputSelector<TState, TProps, T10>,
        InputSelector<TState, TProps, T11>,
        InputSelector<TState, TProps, T12>,
        InputSelector<TState, TProps, T13>,
        InputSelector<TState, TProps, T14>,
        InputSelector<TState, TProps, T15>,
        InputSelector<TState, TProps, T16>
      ],
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7,
        arg8: T8,
        arg9: T9,
        arg10: T10,
        arg11: T11,
        arg12: T12,
        arg13: T13,
        arg14: T14,
        arg15: T15,
        arg16: T16
      ) => TResult
    ): OutputSelector<TState, TProps, TResult>
  };
  // End copied type

  declare type Options =
    | {
        selectorCreator?: CreateSelectorInstance;
        cacheObject: ICacheObject;
      }
    | {
        selectorCreator: CreateSelectorInstance;
        cacheObject?: ICacheObject;
      }
    | CreateSelectorInstance;

  declare type ReOutputSelector<S, R, C> = Selector<S, R> & {
    resultFunc: C;
    recomputations: () => number;
    resetRecomputations: () => number;
  };

  declare type OutputCachedSelector<S, R, C> = (
    resolver: Resolver<S>,
    optionsOrSelectorCreator?: Options
  ) => ReOutputSelector<S, R, C> & {
    getMatchingSelector: (state: S, ...args: any[]) => ReOutputSelector<S, R, C>;
    removeMatchingSelector: (state: S, ...args: any[]) => void;
    clearCache: () => void;
    resultFunc: C;
    cache: ICacheObject;
  };

  declare type ParametricSelector<S, P, R> = (
    state: S,
    props: P,
    ...args: any[]
  ) => R;

  declare type ParametricResolver<S, P> = (
    state: S,
    props: P,
    ...args: any[]
  ) => any;

  declare type OutputParametricSelector<S, P, R, C> = ParametricSelector<
    S,
    P,
    R
  > & {
    resultFunc: C;
    recomputations: () => number;
    resetRecomputations: () => number;
  };

  declare type OutputParametricCachedSelector<S, P, R, C> = (
    resolver: ParametricResolver<S, P>,
    optionsOrSelectorCreator?: Options
  ) => OutputParametricSelector<S, P, R, C> & {
    getMatchingSelector: (
      state: S,
      props: P,
      ...args: any[]
    ) => OutputParametricSelector<S, P, R, C>;
    removeMatchingSelector: (state: S, props: P, ...args: any[]) => void;
    clearCache: () => void;
    resultFunc: C;
    cache: ICacheObject;
  };


  // Cache interface
  declare interface ICacheObject {
    set(key: any, selectorFn: any): void;
    get(key: any): any;
    remove(key: any): void;
    clear(): void;
    +isValidCacheKey?: () => boolean;
  }


  // Cache implementations
  declare export class FlatObjectCache implements ICacheObject {
    set(key: string | number, selectorFn: any): void;
    get(key: string | number): any;
    remove(key: string | number): void;
    clear(): void;
    isValidCacheKey(): boolean;
  }

  declare export class FifoObjectCache implements ICacheObject {
    constructor(options: {cacheSize: number}): void;
    set(key: string | number, selectorFn: any): void;
    get(key: string | number): any;
    remove(key: string | number): void;
    clear(): void;
    isValidCacheKey(): boolean;
  }

  declare export class LruObjectCache implements ICacheObject {
    constructor(options: {cacheSize: number}): void;
    set(key: string | number, selectorFn: any): void;
    get(key: string | number): any;
    remove(key: string | number): void;
    clear(): void;
    isValidCacheKey(): boolean;
  }

  declare export class FlatMapCache implements ICacheObject {
    set(key: any, selectorFn: any): void;
    get(key: any): any;
    remove(key: any): void;
    clear(): void;
  }

  declare export class FifoMapCache implements ICacheObject {
    constructor(options: {cacheSize: number}): void;
    set(key: any, selectorFn: any): void;
    get(key: any): any;
    remove(key: any): void;
    clear(): void;
  }

  declare export class LruMapCache implements ICacheObject {
    constructor(options: {cacheSize: number}): void;
    set(key: any, selectorFn: any): void;
    get(key: any): any;
    remove(key: any): void;
    clear(): void;
  }


  /* 1 selector */
  // Argument form
  declare export default function createCachedSelector<S, R, T>(selector: Selector<S, R>, combiner: (res: R) => T): OutputCachedSelector<S, T, (res: R) => T>;
  declare export default function createCachedSelector<S, P, R, T>(selector: ParametricSelector<S, P, R>, combiner: (res: R) => T): OutputParametricCachedSelector<S, P, T, (res: R) => T>;
  // Array form
  declare export default function createCachedSelector<S, R, T>(selectors: [Selector<S, R>], combiner: (res: R) => T): OutputCachedSelector<S, T, (res: R) => T>;
  declare export default function createCachedSelector<S, P, R, T>(selectors: [ParametricSelector<S, P, R>], combiner: (res: R) => T): OutputParametricCachedSelector<S, P, T, (res: R) => T>;

  //
  // The type definitions below have been generated using this ugly helper (called in a loop)
  //
  // ~~~javascript
  // const ntimesFactory = n => f => Array(n).fill(null).map((_, i) => f(i))
  //
  // const genTypes = (n) => {
  //   const ntimes = ntimesFactory(n)
  //   return `
  //   /* ${n} selectors */
  //   // Argument form
  //   declare export default function createCachedSelector<S, ${ntimes(i => `R${i+1}`).join(', ')}, T>(${ntimes(i => `selector${i+1}: Selector<S, R${i+1}>`).join(', ')}, combiner: (${ntimes(i => `res${i+1}: R${i+1}`).join(', ')}) => T): OutputCachedSelector<S, T, (${ntimes(i => `res${i+1}: R${i+1}`).join(', ')}) => T>;
  //   declare export default function createCachedSelector<S, P, ${ntimes(i => `R${i+1}`).join(', ')}, T>(${ntimes(i => `selector${i+1}: ParametricSelector<S, P, R${i+1}>`).join(', ')}, combiner: (${ntimes(i => `res${i+1}: R${i+1}`).join(', ')}) => T): OutputParametricCachedSelector<S, P, T, (${ntimes(i => `res${i+1}: R${i+1}`).join(', ')}) => T>;
  //   // Array form
  //   declare export default function createCachedSelector<S, ${ntimes(i => `R${i+1}`).join(', ')}, T>(selectors: [${ntimes(i => `Selector<S, R${i+1}>`).join(', ')}], combiner: (${ntimes(i => `res${i+1}: R${i+1}`).join(', ')}) => T): OutputCachedSelector<S, T, (${ntimes(i => `res${i+1}: R${i+1}`).join(', ')}) => T>;
  //   declare export default function createCachedSelector<S, P, ${ntimes(i => `R${i+1}`).join(', ')}, T>(selectors: [${ntimes(i => `ParametricSelector<S, P, R${i+1}>`).join(', ')}], combiner: (${ntimes(i => `res${i+1}: R${i+1}`).join(', ')}) => T): OutputParametricCachedSelector<S, P, T, (${ntimes(i => `res${i+1}: R${i+1}`).join(', ')}) => T>;
  // `
  // }
  // ~~~
  //
  // and then calling `ntimesFactory(13)(genTypes).slice(2).join('')`
  //

  /* 2 selectors */
  // Argument form
  declare export default function createCachedSelector<S, R1, R2, T>(selector1: Selector<S, R1>, selector2: Selector<S, R2>, combiner: (res1: R1, res2: R2) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, T>(selector1: ParametricSelector<S, P, R1>, selector2: ParametricSelector<S, P, R2>, combiner: (res1: R1, res2: R2) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2) => T>;
  // Array form
  declare export default function createCachedSelector<S, R1, R2, T>(selectors: [Selector<S, R1>, Selector<S, R2>], combiner: (res1: R1, res2: R2) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, T>(selectors: [ParametricSelector<S, P, R1>, ParametricSelector<S, P, R2>], combiner: (res1: R1, res2: R2) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2) => T>;

  /* 3 selectors */
  // Argument form
  declare export default function createCachedSelector<S, R1, R2, R3, T>(selector1: Selector<S, R1>, selector2: Selector<S, R2>, selector3: Selector<S, R3>, combiner: (res1: R1, res2: R2, res3: R3) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, T>(selector1: ParametricSelector<S, P, R1>, selector2: ParametricSelector<S, P, R2>, selector3: ParametricSelector<S, P, R3>, combiner: (res1: R1, res2: R2, res3: R3) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3) => T>;
  // Array form
  declare export default function createCachedSelector<S, R1, R2, R3, T>(selectors: [Selector<S, R1>, Selector<S, R2>, Selector<S, R3>], combiner: (res1: R1, res2: R2, res3: R3) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, T>(selectors: [ParametricSelector<S, P, R1>, ParametricSelector<S, P, R2>, ParametricSelector<S, P, R3>], combiner: (res1: R1, res2: R2, res3: R3) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3) => T>;

  /* 4 selectors */
  // Argument form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, T>(selector1: Selector<S, R1>, selector2: Selector<S, R2>, selector3: Selector<S, R3>, selector4: Selector<S, R4>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, T>(selector1: ParametricSelector<S, P, R1>, selector2: ParametricSelector<S, P, R2>, selector3: ParametricSelector<S, P, R3>, selector4: ParametricSelector<S, P, R4>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4) => T>;
  // Array form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, T>(selectors: [Selector<S, R1>, Selector<S, R2>, Selector<S, R3>, Selector<S, R4>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, T>(selectors: [ParametricSelector<S, P, R1>, ParametricSelector<S, P, R2>, ParametricSelector<S, P, R3>, ParametricSelector<S, P, R4>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4) => T>;

  /* 5 selectors */
  // Argument form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, T>(selector1: Selector<S, R1>, selector2: Selector<S, R2>, selector3: Selector<S, R3>, selector4: Selector<S, R4>, selector5: Selector<S, R5>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, T>(selector1: ParametricSelector<S, P, R1>, selector2: ParametricSelector<S, P, R2>, selector3: ParametricSelector<S, P, R3>, selector4: ParametricSelector<S, P, R4>, selector5: ParametricSelector<S, P, R5>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5) => T>;
  // Array form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, T>(selectors: [Selector<S, R1>, Selector<S, R2>, Selector<S, R3>, Selector<S, R4>, Selector<S, R5>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, T>(selectors: [ParametricSelector<S, P, R1>, ParametricSelector<S, P, R2>, ParametricSelector<S, P, R3>, ParametricSelector<S, P, R4>, ParametricSelector<S, P, R5>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5) => T>;

  /* 6 selectors */
  // Argument form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, T>(selector1: Selector<S, R1>, selector2: Selector<S, R2>, selector3: Selector<S, R3>, selector4: Selector<S, R4>, selector5: Selector<S, R5>, selector6: Selector<S, R6>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, T>(selector1: ParametricSelector<S, P, R1>, selector2: ParametricSelector<S, P, R2>, selector3: ParametricSelector<S, P, R3>, selector4: ParametricSelector<S, P, R4>, selector5: ParametricSelector<S, P, R5>, selector6: ParametricSelector<S, P, R6>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6) => T>;
  // Array form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, T>(selectors: [Selector<S, R1>, Selector<S, R2>, Selector<S, R3>, Selector<S, R4>, Selector<S, R5>, Selector<S, R6>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, T>(selectors: [ParametricSelector<S, P, R1>, ParametricSelector<S, P, R2>, ParametricSelector<S, P, R3>, ParametricSelector<S, P, R4>, ParametricSelector<S, P, R5>, ParametricSelector<S, P, R6>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6) => T>;

  /* 7 selectors */
  // Argument form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, R7, T>(selector1: Selector<S, R1>, selector2: Selector<S, R2>, selector3: Selector<S, R3>, selector4: Selector<S, R4>, selector5: Selector<S, R5>, selector6: Selector<S, R6>, selector7: Selector<S, R7>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, R7, T>(selector1: ParametricSelector<S, P, R1>, selector2: ParametricSelector<S, P, R2>, selector3: ParametricSelector<S, P, R3>, selector4: ParametricSelector<S, P, R4>, selector5: ParametricSelector<S, P, R5>, selector6: ParametricSelector<S, P, R6>, selector7: ParametricSelector<S, P, R7>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7) => T>;
  // Array form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, R7, T>(selectors: [Selector<S, R1>, Selector<S, R2>, Selector<S, R3>, Selector<S, R4>, Selector<S, R5>, Selector<S, R6>, Selector<S, R7>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, R7, T>(selectors: [ParametricSelector<S, P, R1>, ParametricSelector<S, P, R2>, ParametricSelector<S, P, R3>, ParametricSelector<S, P, R4>, ParametricSelector<S, P, R5>, ParametricSelector<S, P, R6>, ParametricSelector<S, P, R7>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7) => T>;

  /* 8 selectors */
  // Argument form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, R7, R8, T>(selector1: Selector<S, R1>, selector2: Selector<S, R2>, selector3: Selector<S, R3>, selector4: Selector<S, R4>, selector5: Selector<S, R5>, selector6: Selector<S, R6>, selector7: Selector<S, R7>, selector8: Selector<S, R8>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, R7, R8, T>(selector1: ParametricSelector<S, P, R1>, selector2: ParametricSelector<S, P, R2>, selector3: ParametricSelector<S, P, R3>, selector4: ParametricSelector<S, P, R4>, selector5: ParametricSelector<S, P, R5>, selector6: ParametricSelector<S, P, R6>, selector7: ParametricSelector<S, P, R7>, selector8: ParametricSelector<S, P, R8>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8) => T>;
  // Array form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, R7, R8, T>(selectors: [Selector<S, R1>, Selector<S, R2>, Selector<S, R3>, Selector<S, R4>, Selector<S, R5>, Selector<S, R6>, Selector<S, R7>, Selector<S, R8>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, R7, R8, T>(selectors: [ParametricSelector<S, P, R1>, ParametricSelector<S, P, R2>, ParametricSelector<S, P, R3>, ParametricSelector<S, P, R4>, ParametricSelector<S, P, R5>, ParametricSelector<S, P, R6>, ParametricSelector<S, P, R7>, ParametricSelector<S, P, R8>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8) => T>;

  /* 9 selectors */
  // Argument form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, R7, R8, R9, T>(selector1: Selector<S, R1>, selector2: Selector<S, R2>, selector3: Selector<S, R3>, selector4: Selector<S, R4>, selector5: Selector<S, R5>, selector6: Selector<S, R6>, selector7: Selector<S, R7>, selector8: Selector<S, R8>, selector9: Selector<S, R9>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, R7, R8, R9, T>(selector1: ParametricSelector<S, P, R1>, selector2: ParametricSelector<S, P, R2>, selector3: ParametricSelector<S, P, R3>, selector4: ParametricSelector<S, P, R4>, selector5: ParametricSelector<S, P, R5>, selector6: ParametricSelector<S, P, R6>, selector7: ParametricSelector<S, P, R7>, selector8: ParametricSelector<S, P, R8>, selector9: ParametricSelector<S, P, R9>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9) => T>;
  // Array form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, R7, R8, R9, T>(selectors: [Selector<S, R1>, Selector<S, R2>, Selector<S, R3>, Selector<S, R4>, Selector<S, R5>, Selector<S, R6>, Selector<S, R7>, Selector<S, R8>, Selector<S, R9>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, R7, R8, R9, T>(selectors: [ParametricSelector<S, P, R1>, ParametricSelector<S, P, R2>, ParametricSelector<S, P, R3>, ParametricSelector<S, P, R4>, ParametricSelector<S, P, R5>, ParametricSelector<S, P, R6>, ParametricSelector<S, P, R7>, ParametricSelector<S, P, R8>, ParametricSelector<S, P, R9>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9) => T>;

  /* 10 selectors */
  // Argument form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, T>(selector1: Selector<S, R1>, selector2: Selector<S, R2>, selector3: Selector<S, R3>, selector4: Selector<S, R4>, selector5: Selector<S, R5>, selector6: Selector<S, R6>, selector7: Selector<S, R7>, selector8: Selector<S, R8>, selector9: Selector<S, R9>, selector10: Selector<S, R10>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, T>(selector1: ParametricSelector<S, P, R1>, selector2: ParametricSelector<S, P, R2>, selector3: ParametricSelector<S, P, R3>, selector4: ParametricSelector<S, P, R4>, selector5: ParametricSelector<S, P, R5>, selector6: ParametricSelector<S, P, R6>, selector7: ParametricSelector<S, P, R7>, selector8: ParametricSelector<S, P, R8>, selector9: ParametricSelector<S, P, R9>, selector10: ParametricSelector<S, P, R10>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10) => T>;
  // Array form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, T>(selectors: [Selector<S, R1>, Selector<S, R2>, Selector<S, R3>, Selector<S, R4>, Selector<S, R5>, Selector<S, R6>, Selector<S, R7>, Selector<S, R8>, Selector<S, R9>, Selector<S, R10>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, T>(selectors: [ParametricSelector<S, P, R1>, ParametricSelector<S, P, R2>, ParametricSelector<S, P, R3>, ParametricSelector<S, P, R4>, ParametricSelector<S, P, R5>, ParametricSelector<S, P, R6>, ParametricSelector<S, P, R7>, ParametricSelector<S, P, R8>, ParametricSelector<S, P, R9>, ParametricSelector<S, P, R10>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10) => T>;

  /* 11 selectors */
  // Argument form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, T>(selector1: Selector<S, R1>, selector2: Selector<S, R2>, selector3: Selector<S, R3>, selector4: Selector<S, R4>, selector5: Selector<S, R5>, selector6: Selector<S, R6>, selector7: Selector<S, R7>, selector8: Selector<S, R8>, selector9: Selector<S, R9>, selector10: Selector<S, R10>, selector11: Selector<S, R11>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, T>(selector1: ParametricSelector<S, P, R1>, selector2: ParametricSelector<S, P, R2>, selector3: ParametricSelector<S, P, R3>, selector4: ParametricSelector<S, P, R4>, selector5: ParametricSelector<S, P, R5>, selector6: ParametricSelector<S, P, R6>, selector7: ParametricSelector<S, P, R7>, selector8: ParametricSelector<S, P, R8>, selector9: ParametricSelector<S, P, R9>, selector10: ParametricSelector<S, P, R10>, selector11: ParametricSelector<S, P, R11>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11) => T>;
  // Array form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, T>(selectors: [Selector<S, R1>, Selector<S, R2>, Selector<S, R3>, Selector<S, R4>, Selector<S, R5>, Selector<S, R6>, Selector<S, R7>, Selector<S, R8>, Selector<S, R9>, Selector<S, R10>, Selector<S, R11>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, T>(selectors: [ParametricSelector<S, P, R1>, ParametricSelector<S, P, R2>, ParametricSelector<S, P, R3>, ParametricSelector<S, P, R4>, ParametricSelector<S, P, R5>, ParametricSelector<S, P, R6>, ParametricSelector<S, P, R7>, ParametricSelector<S, P, R8>, ParametricSelector<S, P, R9>, ParametricSelector<S, P, R10>, ParametricSelector<S, P, R11>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11) => T>;

  /* 12 selectors */
  // Argument form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, T>(selector1: Selector<S, R1>, selector2: Selector<S, R2>, selector3: Selector<S, R3>, selector4: Selector<S, R4>, selector5: Selector<S, R5>, selector6: Selector<S, R6>, selector7: Selector<S, R7>, selector8: Selector<S, R8>, selector9: Selector<S, R9>, selector10: Selector<S, R10>, selector11: Selector<S, R11>, selector12: Selector<S, R12>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11, res12: R12) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11, res12: R12) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, T>(selector1: ParametricSelector<S, P, R1>, selector2: ParametricSelector<S, P, R2>, selector3: ParametricSelector<S, P, R3>, selector4: ParametricSelector<S, P, R4>, selector5: ParametricSelector<S, P, R5>, selector6: ParametricSelector<S, P, R6>, selector7: ParametricSelector<S, P, R7>, selector8: ParametricSelector<S, P, R8>, selector9: ParametricSelector<S, P, R9>, selector10: ParametricSelector<S, P, R10>, selector11: ParametricSelector<S, P, R11>, selector12: ParametricSelector<S, P, R12>, combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11, res12: R12) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11, res12: R12) => T>;
  // Array form
  declare export default function createCachedSelector<S, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, T>(selectors: [Selector<S, R1>, Selector<S, R2>, Selector<S, R3>, Selector<S, R4>, Selector<S, R5>, Selector<S, R6>, Selector<S, R7>, Selector<S, R8>, Selector<S, R9>, Selector<S, R10>, Selector<S, R11>, Selector<S, R12>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11, res12: R12) => T): OutputCachedSelector<S, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11, res12: R12) => T>;
  declare export default function createCachedSelector<S, P, R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, T>(selectors: [ParametricSelector<S, P, R1>, ParametricSelector<S, P, R2>, ParametricSelector<S, P, R3>, ParametricSelector<S, P, R4>, ParametricSelector<S, P, R5>, ParametricSelector<S, P, R6>, ParametricSelector<S, P, R7>, ParametricSelector<S, P, R8>, ParametricSelector<S, P, R9>, ParametricSelector<S, P, R10>, ParametricSelector<S, P, R11>, ParametricSelector<S, P, R12>], combiner: (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11, res12: R12) => T): OutputParametricCachedSelector<S, P, T, (res1: R1, res2: R2, res3: R3, res4: R4, res5: R5, res6: R6, res7: R7, res8: R8, res9: R9, res10: R10, res11: R11, res12: R12) => T>;
}
