import {pickState} from './team-pick-lib'

test('the second account alone is picked', () => {
  expect(pickState(['testuser'], 'testuser')).toBe('picked')
})

test('no pick is none', () => {
  expect(pickState([], 'testuser')).toBe('none')
})

test('someone else, or the second account with someone else, is stray', () => {
  expect(pickState(['testuser-mac'], 'testuser')).toBe('stray')
  expect(pickState(['testuser', 'testuser-mac'], 'testuser')).toBe('stray')
  expect(pickState(['testuser-mac', 'testuser'], 'testuser')).toBe('stray')
})
