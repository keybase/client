import TestRenderer, {act} from 'react-test-renderer'
import Text from '@/common-adapters/text'
import * as T from '@/constants/types'
import Markdown, {isAllEmoji, parseMarkdown, shouldUseParser} from './index'
import {setServiceDecoration} from './react'

jest.mock('@/common-adapters/emoji/native-emoji', () => {
  const React = require('react')
  const Text = require('@/common-adapters/text').default

  const MockNativeEmoji = (props: {emojiName: string; size: number}) =>
    React.createElement(
      Text,
      {
        title: `emoji:${props.emojiName}:${props.size}`,
        type: 'Body',
      },
      props.emojiName
    )

  return {
    __esModule: true,
    default: MockNativeEmoji,
  }
})

const MockServiceDecoration = (props: {json: string}) => (
  <Text title={`service:${props.json}`} type="Body">
    {props.json}
  </Text>
)

const makeServiceDecorationTag = (payload: unknown) =>
  `$>kb$${Buffer.from(JSON.stringify(payload)).toString('base64')}$<kb$`

const extractText = (node: any): string => {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  return extractText(node.children)
}

const flattenAstText = (nodes: Array<{type: string; content?: unknown}>): string => {
  return nodes
    .map(node => {
      if (node.type === 'newline') return '\n'
      if (typeof node.content === 'string') return node.content
      if (Array.isArray(node.content)) return flattenAstText(node.content as Array<{type: string; content?: unknown}>)
      return ''
    })
    .join('')
}

const paragraphContent = (input: string, options?: Parameters<typeof parseMarkdown>[1]) => {
  const ast = parseMarkdown(input, options)
  expect(ast[0]?.type).toBe('paragraph')
  return ast[0]?.content as Array<{type: string; content?: unknown; raw?: string}>
}

beforeAll(() => {
  setServiceDecoration(MockServiceDecoration as any)
})

test('parseMarkdown wraps plain text in a paragraph', () => {
  const content = paragraphContent('hello world')
  expect(content).toHaveLength(1)
  expect(content[0]).toMatchObject({content: 'hello world', type: 'text'})
})

test('parseMarkdown keeps inline newlines inside a paragraph', () => {
  const content = paragraphContent('alpha\nbeta')
  expect(content.map(node => node.type)).toEqual(['text', 'newline', 'text'])
  expect(content[0]?.content).toBe('alpha')
  expect(content[2]?.content).toBe('beta')
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
  expect((content[0]?.content as Array<{content: string}>)[0]?.content).toBe('bold')
  expect((content[2]?.content as Array<{content: string}>)[0]?.content).toBe('italic')
  expect((content[4]?.content as Array<{content: string}>)[0]?.content).toBe('strike')
  expect(content[6]?.content).toBe('code')
})

test('parseMarkdown preserves escaped formatting characters as text', () => {
  const content = paragraphContent('\\*not bold\\*')
  expect(content.some(node => node.type === 'strong')).toBe(false)
  expect(flattenAstText(content)).toBe('*not bold*')
})

test('parseMarkdown only treats single backticks as inline code', () => {
  const inline = paragraphContent('`code`')
  expect(inline.map(node => node.type)).toEqual(['inlineCode'])
  expect(inline[0]?.content).toBe('code')
})

test('Markdown falls back to raw text for unsupported double-backtick syntax', () => {
  const renderer = TestRenderer.create(<Markdown>{'``code``'}</Markdown>)
  expect(extractText(renderer.toJSON())).toBe('``code``')
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
  const nested = ast[0]?.content as Array<{type: string; content: Array<{type: string; content: string}>}>
  expect(nested[0]?.type).toBe('paragraph')
  expect((nested[0]?.content ?? [])[0]).toMatchObject({content: 'quoted line', type: 'text'})
})

test('parseMarkdown stops block quotes when a line loses the quote marker', () => {
  const ast = parseMarkdown('> quoted line\nplain line')
  expect(ast.map(node => node.type)).toEqual(['blockQuote', 'paragraph'])
  expect(((ast[1]?.content as Array<{content: string}>)[0] ?? {}).content).toBe('plain line')
})

test('parseMarkdown parses quoted fences on desktop without wrapping the preamble', () => {
  const ast = parseMarkdown('> they wrote ```\nfoo\n```')
  expect(ast).toHaveLength(1)
  expect(ast[0]?.type).toBe('blockQuote')
  const nested = ast[0]?.content as Array<{type: string; content?: unknown}>
  expect(nested.map(node => node.type)).toEqual(['text', 'fence'])
  expect(nested[0]?.content).toBe('they wrote')
  expect(nested[1]?.content).toBe('foo\n')
})

test('parseMarkdown wraps quoted fence preambles in paragraphs on mobile', () => {
  const ast = parseMarkdown('> they wrote ```\nfoo\n```', {isMobile: true})
  const nested = ast[0]?.content as Array<{type: string; content?: unknown}>
  expect(nested.map(node => node.type)).toEqual(['paragraph', 'fence'])
  expect((((nested[0]?.content as Array<{content: string}>) ?? [])[0] ?? {}).content).toBe('they wrote')
  expect(nested[1]?.content).toBe('foo\n')
})

test('parseMarkdown parses spoilers with raw content preserved', () => {
  const content = paragraphContent('!>secret<!')
  expect(content.map(node => node.type)).toEqual(['spoiler'])
  expect(content[0]?.raw).toBe('secret')
  expect(((content[0]?.content as Array<{content: string}>) ?? [])[0]?.content).toBe('secret')
})

test('parseMarkdown parses service decoration payloads as opaque nodes', () => {
  const encoded = makeServiceDecorationTag({
    link: {punycode: '', url: 'keybase://team-page/acme'},
    typ: T.RPCChat.UITextDecorationTyp.link,
  })
  const content = paragraphContent(encoded)
  expect(content.map(node => node.type)).toEqual(['serviceDecoration'])
  expect(content[0]?.content).toBe(encoded.slice('$>kb$'.length, -'$<kb$'.length))
})

test('parseMarkdown recognizes emoji shortcodes and unicode emoji', () => {
  const shortcode = paragraphContent(':wave:')
  expect(shortcode.map(node => node.type)).toEqual(['emoji'])
  expect(shortcode[0]?.content).toBe(':wave:')

  const unicode = paragraphContent('🙂')
  expect(unicode.map(node => node.type)).toEqual(['emoji'])
})

test('isAllEmoji only accepts a single line of emoji content', () => {
  expect(isAllEmoji(parseMarkdown(':wave:'))).toBe(true)
  expect(isAllEmoji(parseMarkdown(':wave:\n:wave:'))).toBe(false)
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
  expect(content).toHaveLength(1)
  expect(content[0]?.content).toBe(longPlain)
})

test('Markdown uses big emoji rendering for standalone emoji messages', () => {
  const renderer = TestRenderer.create(<Markdown>:wave:</Markdown>)
  const emojiNode = renderer.root.find(node => node.props.title === 'emoji::wave::32')
  expect(emojiNode.props.title).toBe('emoji::wave::32')
})

test('Markdown keeps default emoji sizing for mixed emoji and text', () => {
  const renderer = TestRenderer.create(<Markdown>:wave: hi</Markdown>)
  const emojiNode = renderer.root.find(node => node.props.title === 'emoji::wave::16')
  expect(emojiNode.props.title).toBe('emoji::wave::16')
})

test('Markdown preview output flattens block quotes into plain text', () => {
  const renderer = TestRenderer.create(
    <Markdown preview={true}>{'> quoted line'}</Markdown>
  )
  expect(extractText(renderer.toJSON())).toContain('> quoted line')
})

test('Markdown serviceOnlyNoWrap skips only the inner service wrapper on desktop', () => {
  const encoded = makeServiceDecorationTag({
    link: {punycode: '', url: 'https://keybase.io'},
    typ: T.RPCChat.UITextDecorationTyp.link,
  })
  const wrapped = TestRenderer.create(<Markdown serviceOnly={true}>{encoded}</Markdown>)
  const unwrapped = TestRenderer.create(<Markdown serviceOnlyNoWrap={true}>{encoded}</Markdown>)

  expect(wrapped.root.findAllByType('span')).toHaveLength(3)
  expect(unwrapped.root.findAllByType('span')).toHaveLength(2)
  expect(extractText(wrapped.toJSON())).toContain(Buffer.from(JSON.stringify({
    link: {punycode: '', url: 'https://keybase.io'},
    typ: T.RPCChat.UITextDecorationTyp.link,
  })).toString('base64'))
})

test('Markdown spoilers stay masked until clicked and then reveal content', () => {
  const renderer = TestRenderer.create(<Markdown context="msg-1">!>secret<!</Markdown>)

  expect(extractText(renderer.toJSON())).toBe('••••••')

  const spoiler = renderer.root.find(node => node.props.title === 'Click to reveal')
  act(() => {
    spoiler.props.onClick({
      preventDefault: () => {},
      stopPropagation: () => {},
    })
  })

  expect(extractText(renderer.toJSON())).toBe('secret')
})
