// @flow
/* eslint-env jest */
import parser from '../parser'

describe('Markdown parser', () => {
  it('parses multiple adjacent emoji correctly', () => {
    const ast = parser.parse(':ok_hand::skin-tone-2::smile::wink:')
    expect(ast).toMatchSnapshot()
  })

  it('parses invalid emoji fragments correctly', () => {
    const ast = parser.parse('one::\n::two\n:three?::\n::four:\n:: :+1:')
    expect(ast).toMatchSnapshot()
  })
})
