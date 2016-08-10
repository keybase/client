// @flow

export type NodeCB = (err: ?any, result: ?any) => void

export type SagaGenerator<Yield, Actions> = Generator<Yield, void, Actions>
