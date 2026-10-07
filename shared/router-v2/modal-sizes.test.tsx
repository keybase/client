/// <reference types="jest" />
import {modalRoutes} from './routes'

// A stand-in for any route's params: every property, call and coercion yields another stand-in, so a
// getOptions function can read whatever params it expects.
const anyValue = (): unknown =>
  new Proxy(() => {}, {
    apply: () => anyValue(),
    get: (_, key) => (key === Symbol.toPrimitive ? () => '' : key === 'then' ? undefined : anyValue()),
  })

const validSizes = new Set([undefined, 'small', 'medium', 'large'])

const optionsOf = (getOptions: unknown) => {
  if (typeof getOptions !== 'function') return getOptions as {modalSize?: unknown} | undefined
  const route = {key: 'test', name: 'test', params: anyValue()}
  return (getOptions as (p: unknown) => {modalSize?: unknown} | undefined)({navigation: anyValue(), route})
}

test('every modal route names a valid desktop box size', () => {
  const invalid = Object.entries(modalRoutes as Record<string, {getOptions?: unknown}>)
    .map(([name, def]) => [name, optionsOf(def.getOptions)?.modalSize] as const)
    .filter(([, size]) => !validSizes.has(size as string | undefined))
  expect(invalid).toEqual([])
})
