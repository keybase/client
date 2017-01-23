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

  it('parses numbers and some symbols emoji', () => {
    const ast = parser.parse(':+1: :100:')
    expect(ast).toMatchSnapshot()
  })

  it('parses urls correctly', () => {
    const ast = parser.parse(`
  Ignore:
    a...b,
    ftp://blah.com,
    gopher://blah.com,
    mailto:blah@blah.com
  Include:
    http://keybase.io
    https://keybase.io
    HTTP://cnn.com
    http://twitter.com
    google.com
    amazon.co.uk.
    keybase.io,
    keybase.io.
    keybase.io?
    keybase.io/a/user/lookup?one=1&two=2
    keybase.io?blah=true
    http://keybase.io/blah/../up-one/index.html
`)
    expect(ast).toMatchSnapshot()
  })
})
