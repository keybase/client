import * as React from 'react'
import SimpleMarkdown from 'simple-markdown'
import * as Styles from '../../styles'
import Text, {type LineClampType} from '../text'
import Box from '../box'
import Markdown from '../markdown'
import Emoji, {type Props as EmojiProps} from '../emoji'
import {emojiIndexByName} from './emoji-gen'
import ServiceDecoration from './service-decoration'

const electronWrapStyle = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
} as const

const markdownStyles = Styles.styleSheetCreate(
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
          borderLeftColor: Styles.globalColors.grey,
          borderLeftWidth: 3,
          borderStyle: 'solid',
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
    } as const)
)

// TODO kill this when we remove the old markdown parser. This check is done at the parsing level.
const EmojiIfExists = React.memo(
  (
    props: EmojiProps & {
      paragraphTextClassName?: string
      style?: Styles.StylesCrossPlatform
      allowFontScaling?: boolean
      lineClamp?: LineClampType
    }
  ) => {
    const emojiNameLower = props.emojiName.toLowerCase()
    const exists = !!emojiIndexByName[emojiNameLower]
    return exists ? (
      <Emoji emojiName={emojiNameLower} size={props.size} allowFontScaling={props.allowFontScaling} />
    ) : (
      <Markdown
        paragraphTextClassName={props.paragraphTextClassName}
        style={props.style}
        lineClamp={props.lineClamp}
        allowFontScaling={props.allowFontScaling}
      >
        {props.emojiName}
      </Markdown>
    )
  }
)

const reactComponentsForMarkdownType = {
  Array: {
    // basically a port of the old reactFor which we used before
    react: (
      arr: Array<SimpleMarkdown.SingleASTNode>,
      output: SimpleMarkdown.ReactOutput,
      state: SimpleMarkdown.State
    ) => {
      const oldKey = state.key
      const result: Array<SimpleMarkdown.ReactElements | string> = []

      // map nestedOutput over the ast, except group any text
      // nodes together into a single string output.
      let lastResult: SimpleMarkdown.ReactElements = null
      for (let i = 0; i < arr.length; i++) {
        state.key = '' + i
        const nodeOut = output(arr[i], state)
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
    react: (
      node: SimpleMarkdown.SingleASTNode,
      output: SimpleMarkdown.ReactOutput,
      state: SimpleMarkdown.State
    ) => (
      <Box key={state.key} style={markdownStyles.quoteStyle}>
        {output(node.content, {...state, inBlockQuote: true})}
      </Box>
    ),
  },
  del: {
    react: (
      node: SimpleMarkdown.SingleASTNode,
      output: SimpleMarkdown.ReactOutput,
      state: SimpleMarkdown.State
    ) => (
      <Text
        type="Body"
        key={state.key}
        style={Styles.collapseStyles([markdownStyles.strikeStyle, state.styleOverride.del])}
        allowFontScaling={state.allowFontScaling}
      >
        {output(node.content, state)}
      </Text>
    ),
  },
  em: {
    react: (
      node: SimpleMarkdown.SingleASTNode,
      output: SimpleMarkdown.ReactOutput,
      state: SimpleMarkdown.State
    ) => (
      <Text
        type="Body"
        key={state.key}
        style={Styles.collapseStyles([markdownStyles.italicStyle, state.styleOverride.em])}
      >
        {output(node.content, state)}
      </Text>
    ),
  },
  emoji: {
    react: (
      node: SimpleMarkdown.SingleASTNode,
      _output: SimpleMarkdown.ReactOutput,
      state: SimpleMarkdown.State
    ) => (
      <Emoji
        emojiName={String(node.content).toLowerCase()}
        size={16}
        key={state.key}
        disableSelecting={state.virtualText}
      />
    ),
  },
  fence: {
    react: (
      node: SimpleMarkdown.SingleASTNode,
      _output: SimpleMarkdown.ReactOutput,
      state: SimpleMarkdown.State
    ) =>
      Styles.isMobile ? (
        <Box key={state.key} style={markdownStyles.codeSnippetBlockTextStyle}>
          <Text
            type="Body"
            style={Styles.collapseStyles([
              markdownStyles.codeSnippetBlockTextStyle,
              state.styleOverride.fence,
            ])}
            allowFontScaling={state.allowFontScaling}
          >
            {node.content}
          </Text>
        </Box>
      ) : (
        <Text
          key={state.key}
          type="Body"
          style={Styles.collapseStyles([markdownStyles.codeSnippetBlockStyle, state.styleOverride.fence])}
        >
          {node.content}
        </Text>
      ),
  },
  inlineCode: {
    react: (
      node: SimpleMarkdown.SingleASTNode,
      _output: SimpleMarkdown.ReactOutput,
      state: SimpleMarkdown.State
    ) => (
      <Text
        type="Body"
        key={state.key}
        style={Styles.collapseStyles([markdownStyles.codeSnippetStyle, state.styleOverride.inlineCode])}
        allowFontScaling={state.allowFontScaling}
      >
        {node.content}
      </Text>
    ),
  },
  newline: {
    react: (
      _node: SimpleMarkdown.SingleASTNode,
      output: SimpleMarkdown.ReactOutput,
      state: SimpleMarkdown.State
    ) =>
      !Styles.isMobile || state.inParagraph ? (
        output({content: '\n', type: 'text'}, state)
      ) : (
        <Text
          type="Body"
          key={state.key}
          style={Styles.collapseStyles([markdownStyles.textBlockStyle, state.styleOverride.paragraph])}
          allowFontScaling={state.allowFontScaling}
        >
          {'\n'}
        </Text>
      ),
  },
  paragraph: {
    react: (
      node: SimpleMarkdown.SingleASTNode,
      output: SimpleMarkdown.ReactOutput,
      state: SimpleMarkdown.State
    ) => (
      <Text
        className={state.paragraphTextClassName}
        type="Body"
        key={state.key}
        style={Styles.collapseStyles([markdownStyles.textBlockStyle, state.styleOverride.paragraph])}
        allowFontScaling={state.allowFontScaling}
      >
        {output(node.content, {...state, inParagraph: true})}
      </Text>
    ),
  },
  serviceDecoration: {
    react: (
      node: SimpleMarkdown.SingleASTNode,
      _output: SimpleMarkdown.ReactOutput,
      state: SimpleMarkdown.State
    ) => (
      <ServiceDecoration
        json={node.content}
        key={state.key}
        allowFontScaling={state.allowFontScaling}
        messageType={state.messageType}
        styleOverride={state.styleOverride}
        styles={markdownStyles as any}
        disableBigEmojis={false}
        disableEmojiAnimation={false}
      />
    ),
  },
  strong: {
    react: (
      node: SimpleMarkdown.SingleASTNode,
      output: SimpleMarkdown.ReactOutput,
      state: SimpleMarkdown.State
    ) => (
      <Text
        type="BodySemibold"
        key={state.key}
        style={Styles.collapseStyles([markdownStyles.boldStyle, state.styleOverride.strong])}
        allowFontScaling={state.allowFontScaling}
      >
        {output(node.content, state)}
      </Text>
    ),
  },
  text: SimpleMarkdown.defaultRules.text,
}

const passthroughForMarkdownType = Object.keys(reactComponentsForMarkdownType).reduce<{
  [key: string]: SimpleMarkdown.ReactOutputRule | SimpleMarkdown.ReactArrayRule
}>((obj, k) => {
  // keep special Array type
  if (k === 'Array') {
    obj[k] = reactComponentsForMarkdownType[k]
  } else {
    obj[k] = {
      react: (
        node: SimpleMarkdown.SingleASTNode,
        output: SimpleMarkdown.ReactOutput,
        state: SimpleMarkdown.State
      ) =>
        typeof node.content !== 'object'
          ? SimpleMarkdown.defaultRules.text.react({content: node.content, type: 'text'}, output, state)
          : output(node.content, state),
    }
  }
  return obj
}, {})

const bigEmojiOutput: SimpleMarkdown.Output<any> = SimpleMarkdown.outputFor(
  {
    ...reactComponentsForMarkdownType,
    emoji: {
      react: (
        node: SimpleMarkdown.SingleASTNode,
        _output: SimpleMarkdown.ReactOutput,
        state: SimpleMarkdown.State
      ) => (
        <Emoji
          style={state.styleOverride?.paragraph}
          emojiName={String(node.content)}
          size={32}
          key={state.key}
          allowFontScaling={state.allowFontScaling}
        />
      ),
    },
    paragraph: {
      react: (
        node: SimpleMarkdown.SingleASTNode,
        output: SimpleMarkdown.ReactOutput,
        state: SimpleMarkdown.State
      ) => (
        <Text
          type="Body"
          key={state.key}
          style={markdownStyles.bigTextBlockStyle}
          allowFontScaling={state.allowFontScaling}
        >
          {output(node.content, {...state, inParagraph: true})}
        </Text>
      ),
    },
  },
  'react'
)

const previewOutput: SimpleMarkdown.Output<any> = SimpleMarkdown.outputFor(
  {
    Array: SimpleMarkdown.defaultRules.Array,
    ...passthroughForMarkdownType,
    blockQuote: {
      react: (
        node: SimpleMarkdown.SingleASTNode,
        output: SimpleMarkdown.ReactOutput,
        state: SimpleMarkdown.State
      ) =>
        React.Children.toArray([output([{content: '> ', type: 'text'}], state), output(node.content, state)]),
    },
    codeBlock: {
      react: (
        node: SimpleMarkdown.SingleASTNode,
        output: SimpleMarkdown.ReactOutput,
        state: SimpleMarkdown.State
      ) =>
        React.Children.toArray([output([{content: ' ', type: 'text'}], state), output(node.content, state)]),
    },
    emoji: {
      react: (
        node: SimpleMarkdown.SingleASTNode,
        output: SimpleMarkdown.ReactOutput,
        state: SimpleMarkdown.State
      ) => reactComponentsForMarkdownType.emoji.react(node, output, state),
    },
    newline: {
      react: (
        _node: SimpleMarkdown.SingleASTNode,
        _output: SimpleMarkdown.ReactOutput,
        _state: SimpleMarkdown.State
      ) => ' ',
    },
    serviceDecoration: {
      react: (
        node: SimpleMarkdown.SingleASTNode,
        _output: SimpleMarkdown.ReactOutput,
        state: SimpleMarkdown.State
      ) => (
        <ServiceDecoration
          json={node.content}
          key={state.key}
          allowFontScaling={state.allowFontScaling}
          styleOverride={state.styleOverride}
          styles={markdownStyles as any}
          disableBigEmojis={true}
          disableEmojiAnimation={true}
        />
      ),
    },
    text: SimpleMarkdown.defaultRules.text,
  },
  'react'
)

const serviceOnlyOutput: SimpleMarkdown.Output<any> = SimpleMarkdown.outputFor(
  {
    Array: SimpleMarkdown.defaultRules.Array,
    ...passthroughForMarkdownType,
    emoji: {
      react: (
        node: SimpleMarkdown.SingleASTNode,
        output: SimpleMarkdown.ReactOutput,
        state: SimpleMarkdown.State
      ) => reactComponentsForMarkdownType.emoji.react(node, output, state),
    },
    serviceDecoration: {
      react: (
        node: SimpleMarkdown.SingleASTNode,
        _output: SimpleMarkdown.ReactOutput,
        state: SimpleMarkdown.State
      ) => (
        <ServiceDecoration
          json={node.content}
          key={state.key}
          allowFontScaling={state.allowFontScaling}
          styleOverride={state.styleOverride}
          styles={markdownStyles as any}
          disableBigEmojis={true}
          disableEmojiAnimation={true}
        />
      ),
    },
    text: SimpleMarkdown.defaultRules.text,
  },
  'react'
)

const reactOutput: SimpleMarkdown.Output<any> = SimpleMarkdown.outputFor(
  reactComponentsForMarkdownType,
  'react'
)

export {EmojiIfExists, bigEmojiOutput, markdownStyles, previewOutput, reactOutput, serviceOnlyOutput}
