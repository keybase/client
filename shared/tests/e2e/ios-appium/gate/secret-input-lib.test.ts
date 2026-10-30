import {fieldProblem, lengthEvalBody, secretEvalBody, withoutSecret} from './secret-input-lib'

test('withoutSecret cuts the secret out of an error message', () => {
  expect(withoutSecret(new Error('x hunter2 y hunter2'), 'hunter2')).toBe('x <secret> y <secret>')
  expect(withoutSecret('plain hunter2', 'hunter2')).toBe('plain <secret>')
  expect(withoutSecret(new Error('ab'), '')).toBe('ab')
})

test('the secret is the last thing in the eval body, JSON-encoded once', () => {
  const body = secretEvalBody('f', 'p"w')
  const encoded = JSON.stringify('p"w')
  expect(body.split(encoded)).toHaveLength(2)
  expect(body.endsWith(`(${encoded})`)).toBe(true)
  expect(body.slice(0, body.lastIndexOf(encoded))).not.toContain('p"w')
  expect(body).toContain(JSON.stringify('f'))
})

test('the length read carries no text of its own and checks the same field', () => {
  expect(lengthEvalBody('f')).toContain(JSON.stringify('f'))
  expect(lengthEvalBody('f')).toContain('.length')
})

test('a failure names field ids only', () => {
  expect(fieldProblem('login-password-input', {focusedID: 'other-input', state: 'other field'})).toBe(
    'the focused text field is other-input, not login-password-input'
  )
  expect(fieldProblem('f', {state: 'nothing focused'})).toBe('no text field is focused; expected f')
  expect(fieldProblem('f', undefined)).toBe('the field f could not be read')
})
