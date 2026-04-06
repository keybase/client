/** @jest-environment jsdom */
/// <reference types="jest" />

import {expect, test} from '@jest/globals'
import {fireEvent} from '@testing-library/dom'
import {render, screen} from '@testing-library/react'
import * as T from '@/constants/types'
import Markdown, {getMarkdownOutputKind, isAllEmoji, parseMarkdown, shouldUseParser} from './index'
import ServiceDecoration from './service-decoration'

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

test('parseMarkdown wraps quoted fence preambles in paragraphs on mobile', () => {
  const ast = parseMarkdown('> they wrote ```\nfoo\n```', {isMobile: true})
  const nested = normalizeInlineContent(ast[0]?.['content'] as Array<{type: string; content?: unknown}>)
  expect(nested.map(node => node.type)).toEqual(['paragraph', 'fence'])
  expect(getTextAt(nested[0]?.['content'] as Array<{content?: string}> | undefined, 0)).toBe('they wrote')
  expect(nested[1]?.['content']).toBe('foo\n')
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

test('ServiceDecoration renders payloads after base64 and UTF-8 decoding', () => {
  const url = 'https://example.com/naive/🙂'
  const encoded = makeServiceDecorationTag({
    link: {punycode: '', url},
    typ: T.RPCChat.UITextDecorationTyp.link,
  })

  render(
    <ServiceDecoration
      json={encoded.slice('$>kb$'.length, -'$<kb$'.length)}
      styles={{linkStyle: undefined, wrapStyle: undefined} as any}
      disableBigEmojis={false}
      disableEmojiAnimation={false}
    />
  )

  expect(document.body.textContent).toContain(url)
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
