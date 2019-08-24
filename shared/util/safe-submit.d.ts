type UnaryFn<A, R> = (a: A) => R
type Component<A> = React$ComponentType<A>
type HOC<Base, Enhanced> = UnaryFn<Component<Base>, Component<Enhanced>>
export declare function safeSubmit<Base>(
  submitProps: Array<keyof Base>,
  resetSafeProps: Array<keyof Base>
): HOC<Base, Base>
export declare function safeSubmitPerMount<Base>(submitProps: Array<keyof Base>): HOC<Base, Base>
