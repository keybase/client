/** @jest-environment jsdom */
/// <reference types="jest" />

import {expect, test} from '@jest/globals'
import {fireEvent} from '@testing-library/dom'
import {render, screen} from '@testing-library/react'
import * as T from '@/constants/types'
import Markdown, {getMarkdownOutputKind, isAllEmoji, parseMarkdown, shouldUseParser} from './index'

const makeServiceDecorationTag = (payload: unknown) =>
  `$>kb$${Buffer.from(JSON.stringify(payload)).toString('base64')}$<kb$`

const flattenAstText = (nodes: Array<{type: string; content?: unknown}>): string => {
  return nodes
    .map(node => {
      if (node.type === 'newline') return '\n'
      if (typeof node['content'] === 'string') return node['content']
      if (Array.isArray(node['content'])) {
        return flattenAstText(node['content'] as Array<{type: string; content?: unknown}>)
      }
      return ''
    })
    .join('')
}

const normalizeInlineContent = <T extends {type: string}>(nodes: Array<T>) =>
  nodes[nodes.length - 1]?.type === 'newline' ? nodes.slice(0, -1) : nodes

const paragraphContent = (input: string, options?: Parameters<typeof parseMarkdown>[1]) => {
  const ast = parseMarkdown(input, options)
  expect(ast[0]?.type).toBe('paragraph')
  return normalizeInlineContent(
    ast[0]?.['content'] as Array<{type: string; content?: unknown; raw?: string}>
  )
}

const getNestedText = (nodes: Array<{content?: unknown}> | undefined, index: number) =>
  ((nodes?.[index]?.['content'] as Array<{content?: string}> | undefined)?.[0]?.['content'] ?? '')

const getTextAt = (nodes: Array<{content?: string}> | undefined, index: number) =>
  nodes?.[index]?.['content'] ?? ''

test('parseMarkdown wraps plain text in a paragraph', () => {
  const content = paragraphContent('hello world')
  expect(content).toHaveLength(1)
  expect(content[0]).toMatchObject({content: 'hello world', type: 'text'})
})

test('parseMarkdown keeps inline newlines inside a paragraph', () => {
  const content = paragraphContent('alpha\nbeta')
  expect(content.map(node => node.type)).toEqual(['text', 'newline', 'text'])
  expect(content[0]?.['content']).toBe('alpha')
  expect(content[2]?.['content']).toBe('beta')
})

test('parseMarkdown recognizes inline markdown variants', () => {
  const content = paragraphContent('*bold* _italic_ ~strike~ `code`')
  expect(content.map(node => node.type)).toEqual([
    'strong',
    'text',
    'em',
    'text',
    'del',
    'text',
    'inlineCode',
  ])
  expect((content[0]?.['content'] as Array<{content: string}>)[0]?.['content']).toBe('bold')
  expect((content[2]?.['content'] as Array<{content: string}>)[0]?.['content']).toBe('italic')
  expect((content[4]?.['content'] as Array<{content: string}>)[0]?.['content']).toBe('strike')
  expect(content[6]?.['content']).toBe('code')
})

test('parseMarkdown preserves escaped formatting characters as text', () => {
  const content = paragraphContent('\\*not bold\\*')
  expect(content.some(node => node.type === 'strong')).toBe(false)
  expect(flattenAstText(content)).toBe('*not bold*')
})

test('parseMarkdown only treats single backticks as inline code', () => {
  const inline = paragraphContent('`code`')
  expect(inline.map(node => node.type)).toEqual(['inlineCode'])
  expect(inline[0]?.['content']).toBe('code')
})

test('Markdown falls back to raw text for unsupported double-backtick syntax', () => {
  render(<Markdown>{'``code``'}</Markdown>)
  expect(document.body.textContent).toContain('``code``')
})

test('parseMarkdown parses fenced code blocks', () => {
  const ast = parseMarkdown('```foo\nbar```')
  expect(ast).toHaveLength(1)
  expect(ast[0]).toMatchObject({content: 'foo\nbar', type: 'fence'})
})

test('parseMarkdown parses block quotes as nested content', () => {
  const ast = parseMarkdown('> quoted line')
  expect(ast).toHaveLength(1)
  expect(ast[0]?.type).toBe('blockQuote')
  const nested = ast[0]?.['content'] as Array<{type: string; content: Array<{type: string; content: string}>}>
  expect(nested[0]?.type).toBe('paragraph')
  expect((nested[0]?.['content'] as Array<{content: string; type: string}> | undefined)?.[0]).toMatchObject({
    content: 'quoted line',
    type: 'text',
  })
})

test('parseMarkdown stops block quotes when a line loses the quote marker', () => {
  const ast = parseMarkdown('> quoted line\nplain line')
  expect(ast.map(node => node.type)).toEqual(['blockQuote', 'paragraph'])
  expect(getTextAt(ast[1]?.['content'] as Array<{content?: string}> | undefined, 0)).toBe('plain line')
})

test('parseMarkdown parses quoted fences on desktop without wrapping the preamble', () => {
  const ast = parseMarkdown('> they wrote ```\nfoo\n```')
  expect(ast).toHaveLength(1)
  expect(ast[0]?.type).toBe('blockQuote')
  const nested = ast[0]?.['content'] as Array<{type: string; content?: unknown}>
  expect(normalizeInlineContent(nested).map(node => node.type)).toEqual(['text', 'fence'])
  expect(nested[0]?.['content']).toBe('they wrote')
  expect(nested[1]?.['content']).toBe('foo\n')
})

test('parseMarkdown keeps a bare quote marker line inside the same block quote', () => {
  const ast = parseMarkdown('> one\n>\n> two')
  expect(ast).toHaveLength(1)
  expect(ast[0]?.type).toBe('blockQuote')
})

test('parseMarkdown trims padding around inline code', () => {
  expect(paragraphContent('` code `')).toEqual([{content: 'code', type: 'inlineCode'}])
})

test('parseMarkdown does not backtrack on padded unterminated inline code', () => {
  const start = Date.now()
  parseMarkdown('`' + ' '.repeat(4000) + 'x')
  expect(Date.now() - start).toBeLessThan(1000)
})

test('parseMarkdown keeps a fully quoted fence inside a single block quote', () => {
  const ast = parseMarkdown('> test one\n> ```\n> hello\n> ```\n> two')
  expect(ast).toHaveLength(1)
  expect(ast[0]?.type).toBe('blockQuote')
  const nested = ast[0]?.['content'] as Array<{type: string; content?: unknown}>
  expect(nested.map(node => node.type)).toEqual(['paragraph', 'fence', 'paragraph'])
  expect(nested[1]?.['content']).toBe('hello\n')
  expect(getTextAt(nested[2]?.['content'] as Array<{content?: string}> | undefined, 0)).toBe('two')
})

test('parseMarkdown keeps indentation inside a fully quoted fence', () => {
  const ast = parseMarkdown('> ```\n>   indented\n> ```')
  const nested = ast[0]?.['content'] as Array<{type: string; content?: unknown}>
  expect(nested[0]).toMatchObject({content: '  indented\n', type: 'fence'})
})

test('parseMarkdown handles a fully quoted fence opened after text on the same line', () => {
  const ast = parseMarkdown('> they wrote ```\n> foo\n> ```')
  expect(ast).toHaveLength(1)
  const nested = ast[0]?.['content'] as Array<{type: string; content?: unknown}>
  expect(nested.map(node => node.type)).toEqual(['paragraph', 'fence'])
  expect(getTextAt(nested[0]?.['content'] as Array<{content?: string}> | undefined, 0)).toBe('they wrote ')
  expect(nested[1]?.['content']).toBe('foo\n')
})

test('parseMarkdown does not create a fence for an unterminated quoted fence', () => {
  const ast = parseMarkdown('> ```\n> hello')
  expect(flattenAstText(ast as Array<{type: string; content?: unknown}>)).toContain('```')
  expect(JSON.stringify(ast)).not.toContain('"fence"')
})

test('parseMarkdown wraps quoted fence preambles in paragraphs on mobile', () => {
  const ast = parseMarkdown('> they wrote ```\nfoo\n```', {isMobile: true})
  const nested = normalizeInlineContent(ast[0]?.['content'] as Array<{type: string; content?: unknown}>)
  expect(nested.map(node => node.type)).toEqual(['paragraph', 'fence'])
  expect(getTextAt(nested[0]?.['content'] as Array<{content?: string}> | undefined, 0)).toBe('they wrote')
  expect(nested[1]?.['content']).toBe('foo\n')
})

test('parseMarkdown parses a known emoji short name', () => {
  expect(paragraphContent(':thumbsup:')).toEqual([{content: ':thumbsup:', type: 'emoji'}])
})

test('parseMarkdown leaves an unknown emoji short name as text', () => {
  expect(paragraphContent(':notanemoji:').every(node => node.type === 'text')).toBe(true)
})

test('parseMarkdown falls back to the bare short name for an unknown skin tone pairing', () => {
  const content = paragraphContent(':thumbsup::skin-tone-99:')
  expect(content[0]).toEqual({content: ':thumbsup:', type: 'emoji'})
  expect(content.slice(1).every(node => node.type === 'text')).toBe(true)
})

// Each of these was one text node -- and so one react element -- per character.
test('parseMarkdown does not split text into a node per character before a url', () => {
  expect(paragraphContent('a'.repeat(2000) + '.com')).toHaveLength(1)
  expect(paragraphContent('https://keybase.io/docs ok').length).toBeLessThan(9)
})

test('parseMarkdown keeps non-latin text in one node', () => {
  expect(paragraphContent('こんにちは、今日はいい天気ですね')).toHaveLength(1)
  expect(paragraphContent('привет как дела у меня всё хорошо')).toHaveLength(1)
  expect(paragraphContent('مرحبا كيف حالك اليوم الطقس جميل')).toHaveLength(1)
})

test('parseMarkdown keeps a run of ordinary punctuation in one node', () => {
  expect(paragraphContent('wait.... really??? no')).toHaveLength(1)
  expect(paragraphContent('e.g. i.e. etc. v1.2.3')).toHaveLength(1)
})

test('parseMarkdown still stops the text run for every markdown marker', () => {
  // if a marker stops counting as a stop character its rule silently stops matching
  expect(paragraphContent('a *b* c').map(n => n.type)).toContain('strong')
  expect(paragraphContent('a _b_ c').map(n => n.type)).toContain('em')
  expect(paragraphContent('a ~b~ c').map(n => n.type)).toContain('del')
  expect(paragraphContent('a `b` c').map(n => n.type)).toContain('inlineCode')
  expect(paragraphContent('a :+1: c').map(n => n.type)).toContain('emoji')
  expect(paragraphContent('a 👍 c').map(n => n.type)).toContain('emoji')
  expect(paragraphContent('a !>b<! c').map(n => n.type)).toContain('spoiler')
  expect(paragraphContent('a \\*b\\* c').every(n => n.type === 'text')).toBe(true)
})

test('parseMarkdown treats a tld only at a word end', () => {
  expect(paragraphContent('x.comx')).toHaveLength(1)
  expect(paragraphContent('foo.tvx')).toHaveLength(1)
  expect(paragraphContent('notes.commercial stuff')).toHaveLength(1)
})

test('parseMarkdown parses keycap emoji', () => {
  expect(paragraphContent('0️⃣')).toEqual([{content: ':zero:', type: 'emoji'}])
})

test('parseMarkdown parses spoilers with raw content preserved', () => {
  const content = paragraphContent('!>secret<!')
  expect(content.map(node => node.type)).toEqual(['spoiler'])
  expect(content[0]?.raw).toBe('secret')
  expect(getNestedText(content, 0)).toBe('secret')
})

test('parseMarkdown parses service decoration payloads as opaque nodes', () => {
  const encoded = makeServiceDecorationTag({
    link: {punycode: '', url: 'keybase://team-page/acme'},
    typ: T.RPCChat.UITextDecorationTyp.link,
  })
  const content = paragraphContent(encoded)
  expect(content.map(node => node.type)).toEqual(['serviceDecoration'])
  expect(content[0]?.['content']).toBe(encoded.slice('$>kb$'.length, -'$<kb$'.length))
})

test('parseMarkdown recognizes emoji shortcodes and unicode emoji', () => {
  const shortcode = paragraphContent(':wave:')
  expect(shortcode.map(node => node.type)).toEqual(['emoji'])
  expect(shortcode[0]?.['content']).toBe(':wave:')

  const unicode = paragraphContent('🙂')
  expect(unicode.map(node => node.type)).toEqual(['emoji'])
})

test('isAllEmoji only accepts a single line of emoji content', () => {
  expect(isAllEmoji(parseMarkdown(':wave:'))).toBe(true)
  expect(isAllEmoji(parseMarkdown(':wave:\n\n:wave:'))).toBe(false)
  expect(isAllEmoji(parseMarkdown(':wave: hi'))).toBe(false)
})

test('shouldUseParser uses the fast-path cutoff for long plain inputs', () => {
  const longPlain = 'a'.repeat(10001)
  const longWithMarker = `${'a'.repeat(10001)}*`

  expect(shouldUseParser('short text')).toBe(true)
  expect(shouldUseParser(longPlain)).toBe(false)
  expect(shouldUseParser(longWithMarker)).toBe(true)
})

test('parseMarkdown preserves long plain inputs through the no-markdown parser', () => {
  const longPlain = 'a'.repeat(10001)
  const content = paragraphContent(longPlain)
  expect(flattenAstText(content).replace(/\n$/, '')).toBe(longPlain)
})

test('Markdown uses big emoji rendering for standalone emoji messages', () => {
  expect(getMarkdownOutputKind(parseMarkdown(':wave:'))).toBe('bigEmoji')
})

test('Markdown renders stock emoji aliases', () => {
  const {container} = render(<Markdown>{':thumbsup:'}</Markdown>)
  expect(container.textContent).toContain('👍')
})

test('Markdown keeps default output for mixed emoji and text', () => {
  expect(getMarkdownOutputKind(parseMarkdown(':wave: hi'))).toBe('default')
})

test('Markdown preview output flattens block quotes into plain text', () => {
  render(<Markdown preview={true}>{'> quoted line'}</Markdown>)
  expect(document.body.textContent).toContain('> quoted line')
})

test('Markdown serviceOnlyNoWrap skips only the inner service wrapper', () => {
  const encoded = makeServiceDecorationTag({
    link: {punycode: '', url: 'https://keybase.io'},
    typ: T.RPCChat.UITextDecorationTyp.link,
  })
  const parseTree = parseMarkdown(encoded)

  expect(getMarkdownOutputKind(parseTree, {serviceOnly: true})).toBe('serviceOnly')
  expect(getMarkdownOutputKind(parseTree, {serviceOnlyNoWrap: true})).toBe('serviceOnlyNoWrap')
})

test('Markdown spoilers render masked output by default', () => {
  render(<Markdown context="msg-1">{'!>secret<!'}</Markdown>)
  expect(screen.getByText('••••••')).toBeTruthy()
})

test('Markdown spoilers reveal content when clicked', () => {
  render(<Markdown context="msg-2">{'!>secret<!'}</Markdown>)
  fireEvent.click(screen.getByTitle('Click to reveal'))
  expect(screen.getByText('secret')).toBeTruthy()
})

// Parsing has to stay linear in the length of the input: a rule that rescans the rest of the line,
// or a whole dotted run, at every position it is tried at is quadratic. Timing on shared CI workers
// is too noisy to gate on, so this only runs locally.
const localOnlyTest = process.env['CI'] || process.env['JENKINS_URL'] ? test.skip : test
const parseTime = (make: (length: number) => string, length: number) => {
  const s = make(length)
  let best = Infinity
  for (let i = 0; i < 5; ++i) {
    const start = performance.now()
    parseMarkdown(s, {shouldUseMarkdownParser: true})
    best = Math.min(best, performance.now() - start)
  }
  return best
}
const expectLinear = (make: (length: number) => string) => {
  parseTime(make, 8000)
  // linear is ~4x for 4x the input, quadratic ~16x. Big enough inputs that a GC pause or a busy
  // CI worker is small next to the parse time.
  expect(parseTime(make, 32000) / parseTime(make, 8000)).toBeLessThan(8)
}
localOnlyTest.each(['>', '> ', '!>', '$>kb$', 'a.', 'a_.', 'a.com.', '.com', '```\\', '_', '*', '~', '*a ', '**a ', '*_~', 'a*b* ', '\\*', '`a``', '!>a*', '_x *a _b* '])(
  'Markdown parses a long run of %j in linear time',
  unit => expectLinear(length => unit.repeat(Math.ceil(length / unit.length)))
)
// each nested level of emphasis reparses its content, so this is linear only because nesting stops
localOnlyTest('Markdown parses deeply nested emphasis in linear time', () => {
  expectLinear(length => '*a '.repeat(length / 6) + 'b' + ' a*'.repeat(length / 6))
})

test('Markdown stops nesting em, strong and del past 16 levels', () => {
  type N = {type: string; content?: unknown}
  const nesting = (nodes: ReadonlyArray<N>): number =>
    Math.max(
      0,
      ...nodes.map(
        n =>
          (['em', 'strong', 'del'].includes(n.type) ? 1 : 0) +
          (Array.isArray(n.content) ? nesting(n.content as ReadonlyArray<N>) : 0)
      )
    )
  // n pairs of stars, each inside the last
  const pairs = (n: number) => '*a '.repeat(n) + 'b' + ' a*'.repeat(n)
  expect(nesting(parseMarkdown(pairs(15)) as Array<N>)).toBe(15)
  expect(nesting(parseMarkdown(pairs(16)) as Array<N>)).toBe(16)
  const deep = parseMarkdown(pairs(20)) as Array<N>
  expect(nesting(deep)).toBe(16)
  expect(flattenAstText(deep)).toBe('a '.repeat(16) + '*a '.repeat(4) + 'b' + ' a*'.repeat(4) + ' a'.repeat(16) + '\n')
})

// Renders the parse as e.g. 'a <B>b</B>' so a table of cases reads at a glance.
const showEmphasis = (input: string) => {
  type N = {type: string; content?: unknown}
  const tags: {[type: string]: string} = {
    del: 'S',
    em: 'I',
    inlineCode: 'CODE',
    serviceDecoration: 'SERVICE',
    spoiler: 'SPOILER',
    strong: 'B',
  }
  const show = (nodes: ReadonlyArray<N>): string =>
    nodes
      .map(n => {
        const tag = tags[n.type]
        if (n.type === 'serviceDecoration') return `<${tag}/>`
        if (tag && !Array.isArray(n.content)) return `<${tag}>${String(n.content)}</${tag}>`
        if (tag) return `<${tag}>${show(n.content as ReadonlyArray<N>)}</${tag}>`
        if (Array.isArray(n.content)) return show(n.content as ReadonlyArray<N>)
        return n.type === 'newline' ? '' : String(n.content)
      })
      .join('')
  return show(parseMarkdown(input) as Array<N>)
}

test.each([
  // like github markdown: * and ~ work inside a word on either side, _ is literal there
  ['test**test**', 'test<B>test</B>'],
  ['**test**test', '<B>test</B>test'],
  ['test*test*', 'test<B>test</B>'],
  ['*test*test', '<B>test</B>test'],
  ['a*b*c', 'a<B>b</B>c'],
  ['test~~test~~', 'test<S>test</S>'],
  ['~~test~~test', '<S>test</S>test'],
  ['test__test__', 'test__test__'],
  ['__test__test', '__test__test'],
  ['snake_case_name', 'snake_case_name'],
  ['__init__.py', '<I>init</I>.py'],
  // whitespace inside the markers is literal
  ['a * b * c', 'a * b * c'],
  // a run is one marker, closed by a run of the same length
  ['**test**', '<B>test</B>'],
  ['***test***', '<B>test</B>'],
  ['x **test** x', 'x <B>test</B> x'],
  ['__test__', '<I>test</I>'],
  ['~~test~~', '<S>test</S>'],
  ['**a*b**', '<B>a*b</B>'],
  ['*a*b*', '<B>a</B>b*'],
  ['_a_b_', '<I>a_b</I>'],
  // nesting
  ['*a **b** c*', '<B>a <B>b</B> c</B>'],
  ['*a *b* c*', '<B>a <B>b</B> c</B>'],
  ['*a *b c*', '*a <B>b c</B>'],
  ['*_test_*', '<B><I>test</I></B>'],
  ['_*test*_', '<I><B>test</B></I>'],
  ['*_~test~_*', '<B><I><S>test</S></I></B>'],
  // punctuation is not part of a word
  ['*bold*.', '<B>bold</B>.'],
  ['(*bold*)', '(<B>bold</B>)'],
  ['"_it_"', '"<I>it</I>"'],
  ['*a* _b_ ~c~', '<B>a</B> <I>b</I> <S>c</S>'],
  // non-latin letters don't count as a word, so _ works without spaces in cjk
  ['日本*強調*です', '日本<B>強調</B>です'],
  ['日本_強調_です', '日本<I>強調</I>です'],
  // a pair doesn't cross a line
  ['*a\nb*', '*ab*'],
  ['*a\\\nb*', '*a\\b*'],
  // an escaped marker doesn't pair
  ['*a\\* b*', '<B>a* b</B>'],
  // an opener left unclosed inside a pair doesn't take the outer pair's closer
  ['_x *a _b* c_', '<I>x <B>a _b</B> c</I>'],
  // a marker inside inline code, a spoiler or a service decoration never pairs with one outside it
  ['use foo*bar or `char* s`', 'use foo*bar or <CODE>char* s</CODE>'],
  ['*a `b*` c*', '<B>a <CODE>b*</CODE> c</B>'],
  ['2*3 !>answer is 6* ok<!', '2*3 <SPOILER>answer is 6* ok</SPOILER>'],
  ['x~y !>z~w<!', 'x~y <SPOILER>z~w</SPOILER>'],
  ['!>*a* b<!', '<SPOILER><B>a</B> b</SPOILER>'],
  [`a*b ${makeServiceDecorationTag({typ: 0})} c*d`, 'a<B>b <SERVICE/> c</B>d'],
  [`a${makeServiceDecorationTag({typ: 0})}*b`, 'a<SERVICE/>*b'],
])('parseMarkdown emphasis %j renders %j', (input, expected) => {
  expect(showEmphasis(input)).toBe(expected)
})
