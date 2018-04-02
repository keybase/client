// flow-typed signature: 93995d92acf1b3af7f5716c43c0a3d1d
// flow-typed version: ca09058fe1/re-reselect_v1.x.x/flow_>=v0.66.x

declare module "re-reselect" {
  declare type Selector<-TState, TProps, TResult> =
    (state: TState, props: TProps, ...rest: any[]) => TResult

  declare type SelectorCreator<TState, TProps, TResult> =
    ((state: TState, props: TProps) => string | number) => Selector<TState, TProps, TResult>


  declare type CreateCachedSelector = {
    <TState, TProps, TResult, T1>(
      selector1: Selector<TState, TProps, T1>,
      resultFunc: (arg1: T1) => TResult
    ): SelectorCreator<TState, TProps, TResult>,
    <TState, TProps, TResult, T1>(
      selectors: [Selector<TState, TProps, T1>],
      resultFunc: (arg1: T1) => TResult
    ): SelectorCreator<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2>(
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      resultFunc: (arg1: T1, arg2: T2) => TResult
    ): SelectorCreator<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2>(
      selectors: [Selector<TState, TProps, T1>, Selector<TState, TProps, T2>],
      resultFunc: (arg1: T1, arg2: T2) => TResult
    ): SelectorCreator<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3>(
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      resultFunc: (arg1: T1, arg2: T2, arg3: T3) => TResult
    ): SelectorCreator<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3>(
      selectors: [
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>
      ],
      resultFunc: (arg1: T1, arg2: T2, arg3: T3) => TResult
    ): SelectorCreator<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4>(
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      selector4: Selector<TState, TProps, T4>,
      resultFunc: (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => TResult
    ): SelectorCreator<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4>(
      selectors: [
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>,
        Selector<TState, TProps, T4>
      ],
      resultFunc: (arg1: T1, arg2: T2, arg3: T3, arg4: T4) => TResult
    ): SelectorCreator<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5>(
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      selector4: Selector<TState, TProps, T4>,
      selector5: Selector<TState, TProps, T5>,
      resultFunc: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => TResult
    ): SelectorCreator<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5>(
      selectors: [
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>,
        Selector<TState, TProps, T4>,
        Selector<TState, TProps, T5>
      ],
      resultFunc: (arg1: T1, arg2: T2, arg3: T3, arg4: T4, arg5: T5) => TResult
    ): SelectorCreator<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6>(
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      selector4: Selector<TState, TProps, T4>,
      selector5: Selector<TState, TProps, T5>,
      selector6: Selector<TState, TProps, T6>,
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6
      ) => TResult
    ): SelectorCreator<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6>(
      selectors: [
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>,
        Selector<TState, TProps, T4>,
        Selector<TState, TProps, T5>,
        Selector<TState, TProps, T6>
      ],
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6
      ) => TResult
    ): SelectorCreator<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7>(
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      selector4: Selector<TState, TProps, T4>,
      selector5: Selector<TState, TProps, T5>,
      selector6: Selector<TState, TProps, T6>,
      selector7: Selector<TState, TProps, T7>,
      resultFunc: (
        arg1: T1,
        arg2: T2,
        arg3: T3,
        arg4: T4,
        arg5: T5,
        arg6: T6,
        arg7: T7
      ) => TResult
    ): SelectorCreator<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7>(
      selectors: [
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>,
        Selector<TState, TProps, T4>,
        Selector<TState, TProps, T5>,
        Selector<TState, TProps, T6>,
        Selector<TState, TProps, T7>
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
    ): SelectorCreator<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8>(
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      selector4: Selector<TState, TProps, T4>,
      selector5: Selector<TState, TProps, T5>,
      selector6: Selector<TState, TProps, T6>,
      selector7: Selector<TState, TProps, T7>,
      selector8: Selector<TState, TProps, T8>,
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
    ): SelectorCreator<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8>(
      selectors: [
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>,
        Selector<TState, TProps, T4>,
        Selector<TState, TProps, T5>,
        Selector<TState, TProps, T6>,
        Selector<TState, TProps, T7>,
        Selector<TState, TProps, T8>
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
    ): SelectorCreator<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8, T9>(
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      selector4: Selector<TState, TProps, T4>,
      selector5: Selector<TState, TProps, T5>,
      selector6: Selector<TState, TProps, T6>,
      selector7: Selector<TState, TProps, T7>,
      selector8: Selector<TState, TProps, T8>,
      selector9: Selector<TState, TProps, T9>,
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
    ): SelectorCreator<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8, T9>(
      selectors: [
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>,
        Selector<TState, TProps, T4>,
        Selector<TState, TProps, T5>,
        Selector<TState, TProps, T6>,
        Selector<TState, TProps, T7>,
        Selector<TState, TProps, T8>,
        Selector<TState, TProps, T9>
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
    ): SelectorCreator<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      selector4: Selector<TState, TProps, T4>,
      selector5: Selector<TState, TProps, T5>,
      selector6: Selector<TState, TProps, T6>,
      selector7: Selector<TState, TProps, T7>,
      selector8: Selector<TState, TProps, T8>,
      selector9: Selector<TState, TProps, T9>,
      selector10: Selector<TState, TProps, T10>,
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
    ): SelectorCreator<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
      selectors: [
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>,
        Selector<TState, TProps, T4>,
        Selector<TState, TProps, T5>,
        Selector<TState, TProps, T6>,
        Selector<TState, TProps, T7>,
        Selector<TState, TProps, T8>,
        Selector<TState, TProps, T9>,
        Selector<TState, TProps, T10>
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
    ): SelectorCreator<TState, TProps, TResult>,

    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      selector4: Selector<TState, TProps, T4>,
      selector5: Selector<TState, TProps, T5>,
      selector6: Selector<TState, TProps, T6>,
      selector7: Selector<TState, TProps, T7>,
      selector8: Selector<TState, TProps, T8>,
      selector9: Selector<TState, TProps, T9>,
      selector10: Selector<TState, TProps, T10>,
      selector11: Selector<TState, TProps, T11>,
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
    ): SelectorCreator<TState, TProps, TResult>,
    <TState, TProps, TResult, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(
      selectors: [
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>,
        Selector<TState, TProps, T4>,
        Selector<TState, TProps, T5>,
        Selector<TState, TProps, T6>,
        Selector<TState, TProps, T7>,
        Selector<TState, TProps, T8>,
        Selector<TState, TProps, T9>,
        Selector<TState, TProps, T10>,
        Selector<TState, TProps, T11>
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
    ): SelectorCreator<TState, TProps, TResult>,

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
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      selector4: Selector<TState, TProps, T4>,
      selector5: Selector<TState, TProps, T5>,
      selector6: Selector<TState, TProps, T6>,
      selector7: Selector<TState, TProps, T7>,
      selector8: Selector<TState, TProps, T8>,
      selector9: Selector<TState, TProps, T9>,
      selector10: Selector<TState, TProps, T10>,
      selector11: Selector<TState, TProps, T11>,
      selector12: Selector<TState, TProps, T12>,
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
    ): SelectorCreator<TState, TProps, TResult>,
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
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>,
        Selector<TState, TProps, T4>,
        Selector<TState, TProps, T5>,
        Selector<TState, TProps, T6>,
        Selector<TState, TProps, T7>,
        Selector<TState, TProps, T8>,
        Selector<TState, TProps, T9>,
        Selector<TState, TProps, T10>,
        Selector<TState, TProps, T11>,
        Selector<TState, TProps, T12>
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
    ): SelectorCreator<TState, TProps, TResult>,

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
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      selector4: Selector<TState, TProps, T4>,
      selector5: Selector<TState, TProps, T5>,
      selector6: Selector<TState, TProps, T6>,
      selector7: Selector<TState, TProps, T7>,
      selector8: Selector<TState, TProps, T8>,
      selector9: Selector<TState, TProps, T9>,
      selector10: Selector<TState, TProps, T10>,
      selector11: Selector<TState, TProps, T11>,
      selector12: Selector<TState, TProps, T12>,
      selector13: Selector<TState, TProps, T13>,
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
    ): SelectorCreator<TState, TProps, TResult>,
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
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>,
        Selector<TState, TProps, T4>,
        Selector<TState, TProps, T5>,
        Selector<TState, TProps, T6>,
        Selector<TState, TProps, T7>,
        Selector<TState, TProps, T8>,
        Selector<TState, TProps, T9>,
        Selector<TState, TProps, T10>,
        Selector<TState, TProps, T11>,
        Selector<TState, TProps, T12>,
        Selector<TState, TProps, T13>
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
    ): SelectorCreator<TState, TProps, TResult>,

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
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      selector4: Selector<TState, TProps, T4>,
      selector5: Selector<TState, TProps, T5>,
      selector6: Selector<TState, TProps, T6>,
      selector7: Selector<TState, TProps, T7>,
      selector8: Selector<TState, TProps, T8>,
      selector9: Selector<TState, TProps, T9>,
      selector10: Selector<TState, TProps, T10>,
      selector11: Selector<TState, TProps, T11>,
      selector12: Selector<TState, TProps, T12>,
      selector13: Selector<TState, TProps, T13>,
      selector14: Selector<TState, TProps, T14>,
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
    ): SelectorCreator<TState, TProps, TResult>,
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
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>,
        Selector<TState, TProps, T4>,
        Selector<TState, TProps, T5>,
        Selector<TState, TProps, T6>,
        Selector<TState, TProps, T7>,
        Selector<TState, TProps, T8>,
        Selector<TState, TProps, T9>,
        Selector<TState, TProps, T10>,
        Selector<TState, TProps, T11>,
        Selector<TState, TProps, T12>,
        Selector<TState, TProps, T13>,
        Selector<TState, TProps, T14>
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
    ): SelectorCreator<TState, TProps, TResult>,

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
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      selector4: Selector<TState, TProps, T4>,
      selector5: Selector<TState, TProps, T5>,
      selector6: Selector<TState, TProps, T6>,
      selector7: Selector<TState, TProps, T7>,
      selector8: Selector<TState, TProps, T8>,
      selector9: Selector<TState, TProps, T9>,
      selector10: Selector<TState, TProps, T10>,
      selector11: Selector<TState, TProps, T11>,
      selector12: Selector<TState, TProps, T12>,
      selector13: Selector<TState, TProps, T13>,
      selector14: Selector<TState, TProps, T14>,
      selector15: Selector<TState, TProps, T15>,
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
    ): SelectorCreator<TState, TProps, TResult>,
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
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>,
        Selector<TState, TProps, T4>,
        Selector<TState, TProps, T5>,
        Selector<TState, TProps, T6>,
        Selector<TState, TProps, T7>,
        Selector<TState, TProps, T8>,
        Selector<TState, TProps, T9>,
        Selector<TState, TProps, T10>,
        Selector<TState, TProps, T11>,
        Selector<TState, TProps, T12>,
        Selector<TState, TProps, T13>,
        Selector<TState, TProps, T14>,
        Selector<TState, TProps, T15>
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
    ): SelectorCreator<TState, TProps, TResult>,

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
      selector1: Selector<TState, TProps, T1>,
      selector2: Selector<TState, TProps, T2>,
      selector3: Selector<TState, TProps, T3>,
      selector4: Selector<TState, TProps, T4>,
      selector5: Selector<TState, TProps, T5>,
      selector6: Selector<TState, TProps, T6>,
      selector7: Selector<TState, TProps, T7>,
      selector8: Selector<TState, TProps, T8>,
      selector9: Selector<TState, TProps, T9>,
      selector10: Selector<TState, TProps, T10>,
      selector11: Selector<TState, TProps, T11>,
      selector12: Selector<TState, TProps, T12>,
      selector13: Selector<TState, TProps, T13>,
      selector14: Selector<TState, TProps, T14>,
      selector15: Selector<TState, TProps, T15>,
      selector16: Selector<TState, TProps, T16>,
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
    ): SelectorCreator<TState, TProps, TResult>,
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
        Selector<TState, TProps, T1>,
        Selector<TState, TProps, T2>,
        Selector<TState, TProps, T3>,
        Selector<TState, TProps, T4>,
        Selector<TState, TProps, T5>,
        Selector<TState, TProps, T6>,
        Selector<TState, TProps, T7>,
        Selector<TState, TProps, T8>,
        Selector<TState, TProps, T9>,
        Selector<TState, TProps, T10>,
        Selector<TState, TProps, T11>,
        Selector<TState, TProps, T12>,
        Selector<TState, TProps, T13>,
        Selector<TState, TProps, T14>,
        Selector<TState, TProps, T15>,
        Selector<TState, TProps, T16>
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
    ): SelectorCreator<TState, TProps, TResult>
  };

  declare module.exports: CreateCachedSelector;
}
