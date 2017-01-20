// @flow
/* eslint-env jest */
import parser from '../parser'

describe('Markdown parser', () => {
  it('parses multiple adjacent emoji correctly', () => {
    const ast = parser.parse(':ok_hand::skin-tone-2::smile::wink:')
    expect(ast).toMatchSnapshot()
  })

  it('parses invalid emoji fragments correctly', () => {
    const ast = parser.parse('one::\n::two\n:three?::\n::four:\n::')
    expect(ast).toMatchSnapshot()
  })

  it('parses urls correctly', () => {
    const ast = parser.parse('This should ignore a...b but include mailto:blah@blah.com http://keybase.io https://keybase.io HTTP://cnn.com http://twitter.com google.com amazon.co.uk. We want to ignore extra chars when links end a sentence like keybase.io, or keybase.io. or keybase.io?')
    expect(ast).toMatchSnapshot()
  })
})
