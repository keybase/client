/// <reference types="jest" />
import {indefiniteArticle, makeInsertMatcher, pluralize, toStringForLog} from './string'

describe('pluralize', () => {
  test('only leaves the word alone for exactly one', () => {
    expect(pluralize('team', 1)).toBe('team')
    expect(pluralize('team', 0)).toBe('teams')
    expect(pluralize('team', 2)).toBe('teams')
    expect(pluralize('team')).toBe('teams')
  })

  test('does not double up an existing trailing s', () => {
    expect(pluralize('bots', 3)).toBe('bots')
    expect(pluralize('bots', 1)).toBe('bots')
  })

  test('handles the empty string', () => {
    expect(pluralize('', 2)).toBe('s')
  })
})

describe('indefiniteArticle', () => {
  test('picks an for vowels regardless of case', () => {
    expect(indefiniteArticle('admin')).toBe('an')
    expect(indefiniteArticle('Owner')).toBe('an')
    expect(indefiniteArticle('Idea')).toBe('an')
  })

  test('picks a for consonants', () => {
    expect(indefiniteArticle('writer')).toBe('a')
    expect(indefiniteArticle('Team')).toBe('a')
  })

  test('returns an empty string for an empty word', () => {
    expect(indefiniteArticle('')).toBe('')
  })

  // every call site passes a team role, and the rule is correct for all of them
  test('is right for every team role, which is all it is ever given', () => {
    expect(indefiniteArticle('owner')).toBe('an')
    expect(indefiniteArticle('admin')).toBe('an')
    expect(indefiniteArticle('writer')).toBe('a')
    expect(indefiniteArticle('reader')).toBe('a')
    expect(indefiniteArticle('bot')).toBe('a')
    expect(indefiniteArticle('restrictedbot')).toBe('a')
  })

  // the rule is orthographic, so it would be wrong for a word like "hour" whose
  // article follows pronunciation; no caller passes one
  test('goes by spelling, not pronunciation', () => {
    expect(indefiniteArticle('hour')).toBe('a')
  })
})

describe('makeInsertMatcher', () => {
  test('matches the filter as a subsequence, not a substring', () => {
    const re = makeInsertMatcher('abc')
    expect(re.test('axxbxxc')).toBe(true)
    expect(re.test('acb')).toBe(false)
  })

  test('is case insensitive', () => {
    expect(makeInsertMatcher('AbC').test('xaxbxcx')).toBe(true)
  })

  test('strips regex metacharacters instead of letting them compile', () => {
    const re = makeInsertMatcher('a.*b')
    expect(re.source).toBe('a.*?b.*?')
    expect(re.test('ab')).toBe(true)
    expect(re.test('ba')).toBe(false)
  })

  test('an all-metacharacter filter matches everything', () => {
    const re = makeInsertMatcher('...')
    expect(re.source).toBe('(?:)')
    expect(re.test('anything')).toBe(true)
  })
})

describe('toStringForLog', () => {
  test('passes strings through and stringifies primitives', () => {
    expect(toStringForLog('hi')).toBe('hi')
    expect(toStringForLog(undefined)).toBe('undefined')
    expect(toStringForLog(5)).toBe('5')
    expect(toStringForLog(false)).toBe('false')
  })

  test('uses the stack for errors', () => {
    const e = new Error('boom')
    expect(toStringForLog(e)).toBe(e.stack)
  })

  test('falls back to an empty string when an error has no stack', () => {
    const e = new Error('boom')
    e.stack = undefined
    expect(toStringForLog(e)).toBe('')
  })

  test('json encodes plain objects and null', () => {
    expect(toStringForLog({a: 1})).toBe('{"a":1}')
    expect(toStringForLog(null)).toBe('null')
  })

  test('stringifies functions', () => {
    expect(toStringForLog(function named() {})).toContain('named')
  })
})
