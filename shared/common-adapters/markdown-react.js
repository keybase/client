// @flow
import React, {PureComponent} from 'react'
import SimpleMarkdown from 'simple-markdown'
import {isMobile} from '../constants/platform'
import * as Styles from '../styles'
import * as Types from '../constants/types/chat2'
import Text from './text'
import Channel from './channel-container'
import Mention from './mention-container'
import Box from './box'
import Emoji from './emoji'
import {emojiIndexByName} from '../markdown/parser'
import type {Props as EmojiProps} from './emoji'

const wrapStyle = Styles.platformStyles({
  isElectron: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  isMobile: {
    color: undefined,
  },
})

const bigTextBlockStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
  },
  isElectron: {
    display: 'block',
    color: 'inherit',
    fontWeight: 'inherit',
  },
  isMobile: {
    fontSize: 32,
    lineHeight: undefined,
  },
})

const textBlockStyle = Styles.platformStyles({
  common: {...wrapStyle},
  isElectron: {display: 'block', color: 'inherit', fontWeight: 'inherit'},
})

const linkStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
  },
  isElectron: {fontWeight: 'inherit'},
  isMobile: {
    fontWeight: undefined,
  },
})
const neutralPreviewStyle = Styles.platformStyles({
  isElectron: {color: 'inherit', fontWeight: 'inherit'},
  isMobile: {color: undefined, fontWeight: undefined},
})

const boldStyle = Styles.platformStyles({
  common: {...wrapStyle},
  isMobile: {color: undefined},
  isElectron: {color: 'inherit'},
})

const italicStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
    fontStyle: 'italic',
  },
  isMobile: {color: undefined, fontWeight: undefined},
  isElectron: {color: 'inherit', fontWeight: 'inherit'},
})

const strikeStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
  },
  isMobile: {
    fontWeight: undefined,
    textDecorationLine: 'line-through',
  },
  isElectron: {
    color: 'inherit',
    fontWeight: 'inherit',
    textDecoration: 'line-through',
  },
})
const quoteStyle = Styles.platformStyles({
  common: {
    borderLeftWidth: 3,
    borderStyle: 'solid',
    borderLeftColor: Styles.globalColors.lightGrey2,
  },
  isElectron: {
    paddingLeft: Styles.globalMargins.small,
    display: 'block',
  },
  isMobile: {
    paddingLeft: Styles.globalMargins.tiny,
  },
})

const codeSnippetStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
    ...Styles.globalStyles.fontTerminal,
    ...Styles.globalStyles.rounded,
    backgroundColor: Styles.globalColors.beige,
    color: Styles.globalColors.blue,
    paddingLeft: Styles.globalMargins.xtiny,
    paddingRight: Styles.globalMargins.xtiny,
  },
  isMobile: {
    fontSize: 15,
  },
  isElectron: {
    fontSize: 12,
  },
})

const codeSnippetBlockStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
    ...codeSnippetStyle,
    backgroundColor: Styles.globalColors.beige,
    marginBottom: Styles.globalMargins.xtiny,
    marginTop: Styles.globalMargins.xtiny,
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
  isElectron: {
    display: 'block',
    color: Styles.globalColors.black_75,
  },
})

const codeSnippetBlockTextStyle = Styles.platformStyles({
  isMobile: {
    ...Styles.globalStyles.fontTerminal,
    fontSize: 15,
    color: Styles.globalColors.black_75,
  },
})

// This is just here to make it nicer to export for the old markdown component. It can be removed when we remove when we remove that
const markdownStyles = {
  boldStyle,
  codeSnippetBlockStyle,
  codeSnippetStyle,
  italicStyle,
  linkStyle,
  neutralPreviewStyle,
  quoteStyle,
  strikeStyle,
  textBlockStyle,
  wrapStyle,
}

class EmojiIfExists extends PureComponent<
  EmojiProps & {style?: any, allowFontScaling?: boolean, lineClamp?: number},
  void
> {
  render() {
    const emojiNameLower = this.props.emojiName.toLowerCase()
    const exists = !!emojiIndexByName[emojiNameLower]
    return exists ? (
      <Emoji
        emojiName={emojiNameLower}
        size={this.props.size}
        allowFontScaling={this.props.allowFontScaling}
      />
    ) : (
      <Text
        type="Body"
        style={this.props.style}
        lineClamp={this.props.lineClamp}
        allowFontScaling={this.props.allowFontScaling}
      >
        {this.props.emojiName}
      </Text>
    )
  }
}

const reactComponentsForMarkdownType = (allowFontScaling: boolean) => ({
  // On mobile we can't have raw text without a Text tag. So we make sure we are in a paragraph or block quote (parent text tag) or we return a new text tag. If it's not mobile we can short circuit and just return the string
  newline: (node, outputFunc, state) =>
    !isMobile || state.inParagraph ? (
      '\n'
    ) : (
      <Text type="Body" key={state.key} style={textBlockStyle} allowFontScaling={allowFontScaling}>
        {'\n'}
      </Text>
    ),
  fence: (node, output, state) => {
    if (isMobile) {
      return (
        <Box key={state.key} style={codeSnippetBlockStyle}>
          <Text type="Body" style={codeSnippetBlockTextStyle} allowFontScaling={allowFontScaling}>
            {node.content}
          </Text>
        </Box>
      )
    }
    return (
      <Text key={state.key} type="Body" style={codeSnippetBlockStyle}>
        {node.content}
      </Text>
    )
  },
  inlineCode: (node, output, state) => {
    return (
      <Text type="Body" key={state.key} style={codeSnippetStyle} allowFontScaling={allowFontScaling}>
        {node.content}
      </Text>
    )
  },
  paragraph: (node, output, state) => {
    return (
      <Text type="Body" key={state.key} style={textBlockStyle} allowFontScaling={allowFontScaling}>
        {output(node.content, {...state, inParagraph: true})}
      </Text>
    )
  },
  strong: (node, output, state) => {
    return (
      <Text type="BodySemibold" key={state.key} style={boldStyle} allowFontScaling={allowFontScaling}>
        {output(node.content, state)}
      </Text>
    )
  },
  em: (node, output, state) => {
    return (
      <Text type="Body" key={state.key} style={italicStyle}>
        {output(node.content, state)}
      </Text>
    )
  },
  del: (node, output, state) => {
    return (
      <Text type="Body" key={state.key} style={strikeStyle} allowFontScaling={allowFontScaling}>
        {output(node.content, state)}
      </Text>
    )
  },
  blockQuote: (node, output, state) => {
    if (isMobile) {
      return (
        <Box key={state.key} style={quoteStyle}>
          {output(node.content, {...state, inBlockQuote: true})}
        </Box>
      )
    }
    return (
      <Box key={state.key} style={quoteStyle}>
        {output(node.content, {...state, inBlockQuote: true})}
      </Box>
    )
  },
  mention: (node, output, state) => {
    // style={{color: undefined}}
    return (
      <Mention
        username={node.content}
        key={state.key}
        style={wrapStyle}
        allowFontScaling={allowFontScaling}
      />
    )
  },
  channel: (node, output, state) => {
    return (
      <Channel
        name={node.content}
        convID={Types.stringToConversationIDKey(node.convID)}
        key={state.key}
        style={linkStyle}
      />
    )
  },
  text: SimpleMarkdown.defaultRules.text.react,
  emoji: (node, output, state) => {
    return <EmojiIfExists emojiName={String(node.content)} size={16} key={state.key} />
  },
  link: (node, output, state) => {
    return (
      <React.Fragment key={state.key}>
        {node.spaceInFront}
        <Text
          className="hover-underline"
          type="BodyPrimaryLink"
          key={state.key}
          style={linkStyle}
          title={node.content}
          onClickURL={node.content}
          onLongPressURL={node.content}
        >
          {node.content}
        </Text>
      </React.Fragment>
    )
  },
})

const ruleOutput = (rules: {[key: string]: (node: any, outputFunc: any, state: any) => any}) => (
  node,
  output,
  state
) => rules[node.type](node, output, state)

const bigEmojiOutputForFontScaling = (allowFontScaling: boolean) =>
  SimpleMarkdown.reactFor(
    ruleOutput({
      ...reactComponentsForMarkdownType(allowFontScaling),
      paragraph: (node, output, state) => (
        <Text type="Body" key={state.key} style={bigTextBlockStyle} allowFontScaling={allowFontScaling}>
          {output(node.content, {...state, inParagraph: true})}
        </Text>
      ),
      emoji: (node, output, state) => {
        return (
          <EmojiIfExists
            emojiName={String(node.content)}
            size={32}
            key={state.key}
            allowFontScaling={allowFontScaling}
          />
        )
      },
    })
  )

const previewOutput = SimpleMarkdown.reactFor(
  (ast: any, output: Function, state: any): any => {
    // leaf node is just the raw value, so it has no ast.type
    if (typeof ast !== 'object') {
      return ast
    }

    switch (ast.type) {
      case 'emoji':
        return reactComponentsForMarkdownType(false).emoji(ast, output, state)
      case 'newline':
        return ' '
      case 'codeBlock':
        return ' ' + output(ast.content, state)
      default:
        return output(ast.content, state)
    }
  }
)

const reactOutputForFontScaling = (allowFontScaling: boolean) =>
  SimpleMarkdown.reactFor(ruleOutput(reactComponentsForMarkdownType(allowFontScaling)))
const reactOutputNoFontScaling = reactOutputForFontScaling(false)
const reactOutputFontScaling = reactOutputForFontScaling(true)

export {
  EmojiIfExists,
  bigEmojiOutputForFontScaling,
  markdownStyles,
  previewOutput,
  reactOutputFontScaling,
  reactOutputNoFontScaling,
}
// Mobile styles to inherit
/*
const styles = styleSheetCreate({
  bold: {color: undefined},
  codeSnippet: {
    ...globalStyles.fontTerminal,
    ...globalStyles.rounded,
    backgroundColor: globalColors.beige,
    color: globalColors.blue,
    fontSize: 15,
    // FIXME not yet supported for nested <Text>:
    // ...globalStyles.rounded,
    // paddingLeft: globalMargins.xtiny,
    // paddingRight: globalMargins.xtiny,
  },
  codeSnippetBlock: {
    ...globalStyles.rounded,
    backgroundColor: globalColors.beige,
    marginBottom: globalMargins.xtiny,
    marginTop: globalMargins.xtiny,
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
    paddingTop: globalMargins.xtiny,
  },
  codeSnippetBlockText: {
    ...globalStyles.fontTerminal,
    fontSize: 15,
    color: globalColors.black_75,
  },
  italic: {color: undefined, fontStyle: 'italic', fontWeight: undefined},
  // The Text component adds default styles which we need to unset so that
  // styles applied to Markdown parent take effect. For instance, we need
  // to unset the default color applied by <Text type="body"> so that
  // <Markdown style={{color: ...}}> works.
  link: {fontWeight: undefined},
  neutral: {color: undefined, fontWeight: undefined},
  quoteBlock: {
    borderLeftColor: globalColors.lightGrey2,
    borderLeftWidth: 3,
    paddingLeft: 8,
  },
  strike: {color: undefined, fontWeight: undefined, textDecorationLine: 'line-through'},
})

*/
