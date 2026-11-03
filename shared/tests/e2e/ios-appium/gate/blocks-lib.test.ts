import {UNBLOCKED, blocksOf, secondBlockedProblem} from './blocks-lib'

describe('blocksOf', () => {
  test("reads the user's own entry", () => {
    const res = [
      {chatBlocked: false, followBlocked: true, username: 'testuser'},
      {chatBlocked: true, followBlocked: false, username: 'testuser-mac'},
    ]
    expect(blocksOf(res, 'testuser-mac')).toEqual({chatBlocked: true, followBlocked: false})
  })

  test('a user not listed, or no answer, is unblocked', () => {
    expect(blocksOf([{chatBlocked: true, followBlocked: true, username: 'testuser'}], 'testuser-mac')).toEqual(UNBLOCKED)
    expect(blocksOf(null, 'testuser-mac')).toEqual(UNBLOCKED)
  })
})

describe('secondBlockedProblem', () => {
  test('unblocked is no problem', () => {
    expect(secondBlockedProblem(UNBLOCKED)).toBeUndefined()
  })

  test('a chat block or a followers block refuses, saying which', () => {
    expect(secondBlockedProblem({chatBlocked: true, followBlocked: true})).toMatch(/blocked \(chat\)/)
    expect(secondBlockedProblem({chatBlocked: false, followBlocked: true})).toMatch(/blocked \(followers\)/)
  })

  test('names the one command that repairs all of it', () => {
    expect(secondBlockedProblem({chatBlocked: true, followBlocked: false})).toMatch(/yarn test:e2e:accounts:setup: it unblocks .* DM's status .* favorite again/)
  })
})
