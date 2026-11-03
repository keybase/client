import {errorCaptureBody} from './errors-lib'
import {uncaughtErrors, UNCAUGHT_PREFIX} from './step-lib'

// A runtime shaped like RN's where it matters: ReactFiberErrorDialog and the global handler both go
// through ExceptionsManager.handleException, whose report logs the error to console.error.
const fakeRuntime = () => {
  const logged: Array<unknown> = []
  const console = {error: (...args: Array<unknown>) => void logged.push(args)}
  const em = {handleException: (e: unknown, _isFatal: boolean) => console.error(e)}
  const dialog = {
    showErrorDialog: (c: {error: unknown; errorBoundary: unknown; componentStack: string}) => {
      em.handleException(c.error, false)
      return false
    },
  }
  let handler = (e: unknown, isFatal: boolean) => em.handleException(e, isFatal)
  const g: Record<string, unknown> = {
    __kbE2ERuntime: 'r1',
    ErrorUtils: {getGlobalHandler: () => handler, setGlobalHandler: (h: typeof handler) => void (handler = h)},
  }
  const modules: Record<string, unknown> = {
    'node_modules/react-native/Libraries/Core/ExceptionsManager.js': {default: em},
    'node_modules/react-native/Libraries/Core/ReactFiberErrorDialog.js': {default: dialog},
  }
  let missing: string | undefined
  const kbModule = (p: string) => {
    if (p === missing) throw new Error(`no module ${p}`)
    return modules[p]
  }
  const run = (clear: boolean) =>
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    (new Function('globalThis', 'kbModule', 'console', errorCaptureBody(clear)) as (...a: Array<unknown>) => unknown)(
      g,
      kbModule,
      console
    )
  return {
    console,
    dialog,
    errors: () => g['__kbE2EErrors'] as Array<string> | undefined,
    g,
    globalError: (e: unknown) => handler(e, false),
    run,
    setMissing: (p: string | undefined) => (missing = p),
  }
}

test('an error a boundary caught is kept once, as a console error', () => {
  const rt = fakeRuntime()
  expect(rt.run(true)).toBe('r1')
  rt.dialog.showErrorDialog({componentStack: '\n in Thrower', error: new Error('handled'), errorBoundary: {}})
  const errors = rt.errors() ?? []
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatch(/^Error: handled\n/)
  expect(uncaughtErrors(errors)).toEqual([])
})

test('a render error no boundary caught is uncaught', () => {
  const rt = fakeRuntime()
  rt.run(true)
  rt.dialog.showErrorDialog({componentStack: '', error: new Error('unhandled'), errorBoundary: null})
  const uncaught = uncaughtErrors(rt.errors() ?? [])
  expect(uncaught).toHaveLength(1)
  expect(uncaught[0]).toMatch(new RegExp(`^${UNCAUGHT_PREFIX}Error: unhandled`))
})

test('an error the global handler passes on to handleException is uncaught once', () => {
  const rt = fakeRuntime()
  rt.run(true)
  rt.globalError(new Error('thrown'))
  expect(uncaughtErrors(rt.errors() ?? [])).toHaveLength(1)
})

test('a plain console.error is kept as one', () => {
  const rt = fakeRuntime()
  rt.run(true)
  rt.console.error('a', {b: 1})
  expect(rt.errors()).toEqual(['a {"b":1}'])
})

test('a module lookup that throws installs nothing, and the next call installs it', () => {
  const rt = fakeRuntime()
  const consoleError = rt.console.error
  rt.setMissing('node_modules/react-native/Libraries/Core/ReactFiberErrorDialog.js')
  expect(() => rt.run(false)).toThrow('no module')
  expect(rt.g['__kbE2EErrors']).toBeUndefined()
  expect(rt.g['__kbE2EErrorsRuntime']).toBeUndefined()
  expect(rt.console.error).toBe(consoleError)
  rt.setMissing(undefined)
  rt.run(false)
  rt.console.error('after')
  expect(rt.errors()).toEqual(['after'])
})

test('installing again in the same runtime clears without wrapping twice', () => {
  const rt = fakeRuntime()
  rt.run(true)
  rt.console.error('first')
  rt.run(false)
  expect(rt.errors()).toEqual(['first'])
  rt.run(true)
  rt.console.error('second')
  expect(rt.errors()).toEqual(['second'])
})
