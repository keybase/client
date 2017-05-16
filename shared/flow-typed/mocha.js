// @flow
// Lifted from https://github.com/flowtype/flow-typed/commit/94e9f7e0a4ae0c1c33e3b2e2319c4eca1e4d23f3#diff-e8832df460d17dc4a93b0a34a90a0cfd
type TestFunction = (done: () => void) => void | Promise<mixed>

declare var describe: {
  (name: string, spec: () => void): void,
  only(description: string, spec: () => void): void,
  skip(description: string, spec: () => void): void,
  timeout(ms: number): void,
}

declare var context: typeof describe

declare var it: {
  (name: string, spec?: TestFunction): void,
  only(description: string, spec: TestFunction): void,
  skip(description: string, spec: TestFunction): void,
  timeout(ms: number): void,
}

declare function before(method: TestFunction): void
declare function beforeEach(method: TestFunction): void
declare function after(method: TestFunction): void
declare function afterEach(method: TestFunction): void
