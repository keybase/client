import * as React from 'react'
import * as SM from '@khanacademy/simple-markdown'
import type * as T from '@/constants/types'
import * as Styles from '@/styles'
import Text from '@/common-adapters/text'
import Box from '@/common-adapters/box'
import Spoiler from './spoiler'
import Emoji from '../emoji'
import type {StyleOverride} from '.'
import type {default as ServiceDecorationType} from './service-decoration'
const SimpleMarkdown = SM.default

let ServiceDecoration: typeof ServiceDecorationType = () => {
  throw new Error('Failed to init markdown')
}
export const setServiceDecoration = (SDT: typeof ServiceDecorationType) => {
  ServiceDecoration = SDT
}

interface State extends SM.State {
  context?: string
  allowFontScaling?: boolean
  disallowAnimation?: boolean
  messageType?: T.Chat.MessageType
  paragraphTextClassName?: string
  styleOverride?: StyleOverride
  virtualText?: boolean
}

const electronWrapStyle = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
} as const

export const markdownStyles = Styles.styleSheetCreate(
  () =>
    ({
      bigTextBlockStyle: Styles.platformStyles({
        isElectron: {
          ...electronWrapStyle,
          color: 'inherit',
          display: 'block',
          fontWeight: 'inherit',
        },
        isMobile: {
          fontSize: 32,
          lineHeight: 39.5, // matches 40 px height
        },
      } as const),
      boldStyle: Styles.platformStyles({
        common: {...Styles.globalStyles.fontBold},
        isElectron: {color: 'inherit', ...electronWrapStyle},
        isMobile: {color: undefined},
      }),
      get codeSnippetBlockStyle() {
        return Styles.platformStyles({
          common: {
            ...this.codeSnippetStyle,
            backgroundColor: Styles.globalColors.redLighter,
            marginBottom: Styles.globalMargins.xtiny,
            marginTop: Styles.globalMargins.xtiny,
            paddingBottom: Styles.globalMargins.xtiny,
            paddingLeft: Styles.globalMargins.tiny,
            paddingRight: Styles.globalMargins.tiny,
            paddingTop: Styles.globalMargins.xtiny,
          },
          isElectron: {
            ...electronWrapStyle,
            color: Styles.globalColors.black,
            display: 'block',
          },
        })
      },
      codeSnippetBlockTextStyle: Styles.platformStyles({
        isMobile: {
          ...Styles.globalStyles.fontTerminal,
          backgroundColor: Styles.globalColors.redLighter,
          color: Styles.globalColors.black,
          fontSize: 15,
        },
      }),
      codeSnippetStyle: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.fontTerminal,
          ...Styles.globalStyles.rounded,
          backgroundColor: Styles.globalColors.redLighter,
          color: Styles.globalColors.blueDarkOrBlueLight,
          paddingLeft: Styles.globalMargins.xtiny,
          paddingRight: Styles.globalMargins.xtiny,
        },
        isElectron: {
          ...electronWrapStyle,
          fontSize: 12,
        },
        isMobile: {fontSize: 15},
      }),
      italicStyle: Styles.platformStyles({
        common: {fontStyle: 'italic'},
        isElectron: {color: 'inherit', fontWeight: 'inherit', ...electronWrapStyle},
        isMobile: {color: undefined, fontWeight: undefined},
      }),
      linkStyle: Styles.platformStyles({
        isElectron: {
          ...electronWrapStyle,
          fontWeight: 'inherit',
        },
        isMobile: {fontWeight: undefined},
      }),
      neutralPreviewStyle: Styles.platformStyles({
        isElectron: {color: 'inherit', fontWeight: 'inherit'},
        isMobile: {color: Styles.globalColors.black_50, fontWeight: undefined},
      }),
      quoteStyle: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.redLighter,
          borderLeftColor: Styles.globalColors.grey,
          borderLeftWidth: 3,
          borderStyle: 'solid',
          color: Styles.globalColors.black,
        },
        isElectron: {
          display: 'block',
          paddingLeft: Styles.globalMargins.small,
        },
        isMobile: {
          paddingLeft: Styles.globalMargins.tiny,
        },
      }),
      strikeStyle: Styles.platformStyles({
        isElectron: {
          ...electronWrapStyle,
          color: 'inherit',
          fontWeight: 'inherit',
          textDecoration: 'line-through',
        } as const,
        isMobile: {
          fontWeight: undefined,
          textDecorationLine: 'line-through',
        },
      }),
      textBlockStyle: Styles.platformStyles({
        isAndroid: {lineHeight: undefined},
        isElectron: {color: 'inherit', display: 'block', fontWeight: 'inherit', ...electronWrapStyle},
      } as const),
      wrapStyle: Styles.platformStyles({isElectron: electronWrapStyle}),
    }) as const
)

const InlineCode = (p: {children: React.ReactNode; state: State}) => {
  const {children, state} = p
  return (
    <Text
      type="Body"
      style={Styles.collapseStyles([markdownStyles.codeSnippetStyle, state.styleOverride?.inlineCode])}
      allowFontScaling={state['allowFontScaling']}
    >
      {children}
    </Text>
  )
}

const Fence = (p: {children: React.ReactNode; state: State}) => {
  const {children, state} = p
  return Styles.isMobile ? (
    <Box style={markdownStyles.codeSnippetBlockTextStyle}>
      <Text
        type="Body"
        style={Styles.collapseStyles([markdownStyles.codeSnippetBlockTextStyle, state.styleOverride?.fence])}
        allowFontScaling={state['allowFontScaling']}
      >
        {children}
      </Text>
    </Box>
  ) : (
    <Text
      type="Body"
      style={Styles.collapseStyles([markdownStyles.codeSnippetBlockStyle, state.styleOverride?.fence])}
    >
      {children}
    </Text>
  )
}

const reactComponentsForMarkdownType = {
  Array: {
    // basically a port of the old reactFor which we used before
    react: (arr: Array<SM.SingleASTNode>, output: SM.ReactOutput, state: State) => {
      const oldKey = state.key
      const result: Array<React.ReactNode | string> = []

      // map nestedOutput over the ast, except group any text
      // nodes together into a single string output.
      let lastResult: React.ReactNode = null
      for (let i = 0; i < arr.length; i++) {
        state.key = '' + i
        const nodeOut = output(arr[i]!, state)
        if (typeof nodeOut === 'string' && typeof lastResult === 'string') {
          lastResult = lastResult + nodeOut
          result[result.length - 1] = lastResult
        } else {
          result.push(nodeOut)
          lastResult = nodeOut
        }
      }

      state.key = oldKey
      return result
    },
  },
  // On mobile we can't have raw text without a Text tag. So we make sure we are in a paragraph or we return a new text tag. If it's not mobile we can short circuit and just return the string
  blockQuote: {
    react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) => {
      const oldInBlockQuote = state['inBlockQuote'] as boolean
      state['inBlockQuote'] = true
      const ret = (
        <Box key={state.key} style={markdownStyles.quoteStyle}>
          {output(node['content'], state)}
        </Box>
      )
      state['inBlockQuote'] = oldInBlockQuote
      return ret
    },
  },
  del: {
    react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) => (
      <Text
        type="Body"
        key={state.key}
        style={Styles.collapseStyles([markdownStyles.strikeStyle, state.styleOverride?.del])}
        allowFontScaling={state['allowFontScaling']}
      >
        {output(node['content'], state)}
      </Text>
    ),
  },
  em: {
    react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) => {
      const oldInsideEM = state['insideEM'] as boolean
      state['insideEM'] = true
      const ret = (
        <Text
          type="Body"
          key={state.key}
          style={Styles.collapseStyles([
            markdownStyles.italicStyle,
            state['insideStrong'] && markdownStyles.boldStyle,
            state.styleOverride?.em,
          ])}
        >
          {output(node['content'], state)}
        </Text>
      )
      state['insideEM'] = oldInsideEM
      return ret
    },
  },
  emoji: {
    react: (node: SM.SingleASTNode, _output: SM.ReactOutput, state: State) => (
      <Emoji
        emojiName={String(node['content']).toLowerCase()}
        size={state.styleOverride?.emojiSize?.size ?? 16}
        key={state.key}
        disableSelecting={state.virtualText}
        style={state.styleOverride?.emoji}
      />
    ),
  },
  fence: {
    react: (node: SM.SingleASTNode, _output: SM.ReactOutput, state: State) => {
      return (
        <Fence key={state.key} state={state}>
          {node['content']}
        </Fence>
      )
    },
  },
  inlineCode: {
    react: (node: SM.SingleASTNode, _output: SM.ReactOutput, state: State) => {
      return (
        <InlineCode key={state.key} state={state}>
          {node['content']}
        </InlineCode>
      )
    },
  },
  newline: {
    react: (_node: SM.SingleASTNode, output: SM.ReactOutput, state: State) =>
      !Styles.isMobile || state['inParagraph'] ? (
        output({content: '\n', type: 'text'}, state)
      ) : (
        <Text
          type="Body"
          key={state.key}
          style={Styles.collapseStyles([markdownStyles.textBlockStyle, state.styleOverride?.paragraph])}
          allowFontScaling={state['allowFontScaling']}
        >
          {'\n'}
        </Text>
      ),
  },
  paragraph: {
    react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) => {
      const oldInParagraph = state['inParagraph'] as boolean
      state['inParagraph'] = true
      const ret = (
        <Text
          className={state.paragraphTextClassName}
          type="Body"
          key={state.key}
          style={Styles.collapseStyles([markdownStyles.textBlockStyle, state.styleOverride?.paragraph])}
          allowFontScaling={state['allowFontScaling']}
        >
          {output(node['content'], state)}
        </Text>
      )
      state['inParagraph'] = oldInParagraph
      return ret
    },
  },
  serviceDecoration: {
    react: (node: SM.SingleASTNode, _output: SM.ReactOutput, state: State) => (
      <ServiceDecoration
        json={node['content']}
        key={state.key}
        allowFontScaling={state['allowFontScaling']}
        messageType={state.messageType}
        styleOverride={state.styleOverride}
        styles={markdownStyles as any}
        disableBigEmojis={false}
        disableEmojiAnimation={false}
      />
    ),
  },
  spoiler: {
    react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) => {
      return (
        <Spoiler key={state.key} context={state.context} content={node['raw']}>
          {output(node['content'], state)}
        </Spoiler>
      )
    },
  },
  strong: {
    react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) => {
      const oldInsideStrong = state['insideStrong'] as boolean
      state['insideStrong'] = true
      const ret = (
        <Text
          type="BodySemibold"
          key={state.key}
          style={Styles.collapseStyles([
            markdownStyles.boldStyle,
            state['insideEM'] && markdownStyles.italicStyle,
            state.styleOverride?.strong,
          ])}
          allowFontScaling={state['allowFontScaling']}
        >
          {output(node['content'], state)}
        </Text>
      )
      state['insideStrong'] = oldInsideStrong
      return ret
    },
  },
  text: SimpleMarkdown.defaultRules.text,
}

const passthroughForMarkdownType = Object.keys(reactComponentsForMarkdownType).reduce<{
  [key: string]: SM.OutputRules<unknown>
}>((obj, k) => {
  // keep special Array type
  if (k === 'Array') {
    obj[k] = reactComponentsForMarkdownType[k]
  } else {
    obj[k] = {
      react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) =>
        typeof node['content'] !== 'object'
          ? SimpleMarkdown.defaultRules.text.react(
              {content: node['content'] as Array<SM.SingleASTNode>, type: 'text'},
              output as any,
              state
            )
          : output(node['content'], state),
    }
  }
  return obj
}, {})

export const bigEmojiOutput: SM.Output<any> = SimpleMarkdown.outputFor(
  {
    ...reactComponentsForMarkdownType,
    emoji: {
      react: (node: SM.SingleASTNode, _output: SM.ReactOutput, state: State) => (
        <Emoji
          style={state.styleOverride?.paragraph}
          emojiName={String(node['content'])}
          size={32}
          key={state.key}
          allowFontScaling={state['allowFontScaling']}
        />
      ),
    },
    paragraph: {
      react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) => {
        const oldInParagraph = state['inParagraph'] as boolean
        state['inParagraph'] = true
        const ret = (
          <Text
            type="Body"
            key={state.key}
            style={markdownStyles.bigTextBlockStyle}
            allowFontScaling={state['allowFontScaling']}
          >
            {output(node['content'], state)}
          </Text>
        )
        state['inParagraph'] = oldInParagraph
        return ret
      },
    },
  },
  'react'
)

export const previewOutput: SM.Output<any> = SimpleMarkdown.outputFor(
  {
    Array: SimpleMarkdown.defaultRules.Array,
    ...passthroughForMarkdownType,
    blockQuote: {
      react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) =>
        React.Children.toArray([
          output([{content: '> ', type: 'text'}], state),
          output(node['content'], state),
        ]),
    },
    codeBlock: {
      react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) =>
        React.Children.toArray([
          output([{content: ' ', type: 'text'}], state),
          output(node['content'], state),
        ]),
    },
    emoji: {
      react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) =>
        reactComponentsForMarkdownType.emoji.react(node, output, state),
    },
    newline: {
      react: (_node: SM.SingleASTNode, _output: SM.ReactOutput, _state: State) => ' ',
    },
    serviceDecoration: {
      react: (node: SM.SingleASTNode, _output: SM.ReactOutput, state: State) => (
        <ServiceDecoration
          json={node['content']}
          key={state.key}
          allowFontScaling={state['allowFontScaling']}
          styleOverride={state.styleOverride}
          styles={markdownStyles as any}
          disableBigEmojis={true}
          disableEmojiAnimation={true}
        />
      ),
    },
    spoiler: {
      react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) => {
        return (
          <Spoiler key={state.key} context={state.context} content={node['raw']}>
            {output(node['content'], state)}
          </Spoiler>
        )
      },
    },
    text: SimpleMarkdown.defaultRules.text,
  },
  'react'
)

export const serviceOnlyOutput: SM.Output<any> = SimpleMarkdown.outputFor(
  {
    Array: SimpleMarkdown.defaultRules.Array,
    ...passthroughForMarkdownType,
    emoji: {
      react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) =>
        reactComponentsForMarkdownType.emoji.react(node, output, state),
    },
    serviceDecoration: {
      react: (node: SM.SingleASTNode, _output: SM.ReactOutput, state: State) => (
        <ServiceDecoration
          json={node['content']}
          key={state.key}
          allowFontScaling={state['allowFontScaling']}
          styleOverride={state.styleOverride}
          styles={markdownStyles as any}
          disableBigEmojis={true}
          disableEmojiAnimation={state.disallowAnimation ?? true}
        />
      ),
    },
    spoiler: {
      react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) => {
        return (
          <Spoiler key={state.key} context={state.context} content={node['raw']}>
            {output(node['content'], state)}
          </Spoiler>
        )
      },
    },
    text: SimpleMarkdown.defaultRules.text,
  },
  'react'
)

export const serviceOnlyNoWrapOutput: SM.Output<any> = SimpleMarkdown.outputFor(
  {
    Array: SimpleMarkdown.defaultRules.Array,
    ...Object.keys(reactComponentsForMarkdownType).reduce<{
      [key: string]: SM.OutputRules<unknown>
    }>((obj, k) => {
      // keep special Array type
      if (k === 'Array') {
        obj[k] = reactComponentsForMarkdownType[k]
      } else {
        obj[k] = {
          react: () => null,
        }
      }
      return obj
    }, {}),
    emoji: {
      react: (node: SM.SingleASTNode, output: SM.ReactOutput, state: State) =>
        reactComponentsForMarkdownType.emoji.react(node, output, state),
    },
    paragraph: {
      react: (node: SM.SingleASTNode, output: SM.ReactOutput) => output(node['content']),
    },
    serviceDecoration: {
      react: (node: SM.SingleASTNode, _output: SM.ReactOutput, state: State) => (
        <ServiceDecoration
          json={node['content']}
          key={state.key}
          allowFontScaling={state['allowFontScaling']}
          styleOverride={state.styleOverride}
          styles={markdownStyles as any}
          disableBigEmojis={true}
          disableEmojiAnimation={state.disallowAnimation ?? true}
        />
      ),
    },
  },
  'react'
)

export const reactOutput: SM.Output<any> = SimpleMarkdown.outputFor(reactComponentsForMarkdownType, 'react')
