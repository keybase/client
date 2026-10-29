import {knownFlowCause, knownNote, knownVerdict} from './known'

describe('known failures', () => {
  const known = {'a › paging › slow': 'Task 10: slow', 'shared title': 'Task 10: by title'}

  test('match by file and title path, or the title path alone', () => {
    expect(knownFlowCause('a', ['paging', 'slow'], known)).toBe('Task 10: slow')
    expect(knownFlowCause('b', ['shared title'], known)).toBe('Task 10: by title')
    expect(knownFlowCause('b', ['paging', 'slow'], known)).toBeUndefined()
  })

  test('a known failure is labelled but still a failure; a passing one asks to be removed', () => {
    expect(knownVerdict(false, 'x')).toBe('known failure')
    expect(knownNote('known failure', 'Task 10: slow', 'list.ts')).toBe('known on master: Task 10: slow')
    expect(knownVerdict(true, 'x')).toBe('known now passes')
    expect(knownNote('known now passes', 'x', 'list.ts')).toBe('known failure now passes — remove it from list.ts')
    expect(knownVerdict(false, undefined)).toBe('new failure')
    expect(knownNote('new failure', undefined, 'list.ts')).toBeUndefined()
  })
})
