type JestMockFn = {
  (...args: Array<any>): any;
  mock: {
    calls: Array<Array<any>>;
    instances: mixed;
  };
  mockClear(): Function;
  mockImplementation(fn: Function): JestMockFn;
  mockImplementationOnce(fn: Function): JestMockFn;
  mockReturnThis(): mixed;
  mockReturnValue(value: any): JestMockFn;
  mockReturnValueOne(value: any): JestMockFn;
}

declare function describe(name: string, fn: Function): void;
declare function it(name: string, fn: Function): void;
declare function pit(name: string, fn: Function): Promise<void>;
declare function beforeEach(fn: Function): void;

type JestExpectType = {
  not: JestExpectType;
  toThrow(message?: string): void;
  toBe(value: any): void;
  toEqual(value: any): void;
  toBeFalsy(): void;
  toBeTruthy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toMatch(regexp: RegExp): void;
  toContain(str: string): void;
  toBeCloseTo(num: number, delta: any): void;
  toBeGreaterThan(number: number): void;
  toBeLessThan(number: number): void;
  toBeCalled(): void;
  toBeCalledWith(...args: Array<any>): void;
  lastCalledWith(...args: Array<any>): void;
}

declare function expect(value: any): JestExpectType;

declare var jest: {
  autoMockOff(): void;
  autoMockOn(): void;
  enableAutomock(): void; // should this be there? not on the docs page
  clearAllTimers(): void;
  currentTestPath(): void;
  fn(implementation?: Function): JestMockFn;
  genMockFromModule(moduleName: string): any;
  mock(moduleName: string, moduleFactory?: any): void;
  runAllTicks(): void;
  runAllTimers(): void;
  runOnlyPendingTimers(): void;
  setMock(moduleName: string, moduleExports: any): void;
  unmock(moduleName: string): void;
}
