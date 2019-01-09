// @flow
import React, {PureComponent} from 'react'
import SimpleMarkdown from 'simple-markdown'
import {isMobile} from '../../constants/platform'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/chat2'
import Text from '../text'
import KbfsPath from './kbfs-path-container'
import Channel from '../channel-container'
import Mention from '../mention-container'
import {type MarkdownMeta, type StyleOverride} from '.'
import Box from '../box'
import Emoji from '../emoji'
import {emojiIndexByName} from './emoji-gen'
import type {Props as EmojiProps} from '../emoji'
import ServiceDecoration from './service-decoration'

const wrapStyle = Styles.platformStyles({
  isElectron: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
})

const bigTextBlockStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
  },
  isElectron: {
    color: 'inherit',
    display: 'block',
    fontWeight: 'inherit',
  },
  isMobile: {
    fontSize: 32,
    lineHeight: undefined,
  },
})

const textBlockStyle = Styles.platformStyles({
  common: {...wrapStyle},
  isElectron: {color: 'inherit', display: 'block', fontWeight: 'inherit'},
})

const linkStyle = Styles.platformStyles({
  isElectron: {
    ...wrapStyle,
    fontWeight: 'inherit',
  },
  isMobile: {
    fontWeight: undefined,
  },
})
const neutralPreviewStyle = Styles.platformStyles({
  isElectron: {color: 'inherit', fontWeight: 'inherit'},
  isMobile: {color: Styles.globalColors.black_50, fontWeight: undefined},
})

const boldStyle = Styles.platformStyles({
  common: {...wrapStyle},
  isElectron: {color: 'inherit'},
  isMobile: {color: undefined},
})

const italicStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
    fontStyle: 'italic',
  },
  isElectron: {color: 'inherit', fontWeight: 'inherit'},
  isMobile: {color: undefined, fontWeight: undefined},
})

const strikeStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
  },
  isElectron: {
    color: 'inherit',
    fontWeight: 'inherit',
    textDecoration: 'line-through',
  },
  isMobile: {
    fontWeight: undefined,
    textDecorationLine: 'line-through',
  },
})

const quoteStyle = Styles.platformStyles({
  common: {
    borderLeftColor: Styles.globalColors.lightGrey2,
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
  isElectron: {
    fontSize: 12,
  },
  isMobile: {
    fontSize: 15,
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
    color: Styles.globalColors.black_75,
    display: 'block',
  },
})

const codeSnippetBlockTextStyle = Styles.platformStyles({
  isMobile: {
    ...Styles.globalStyles.fontTerminal,
    color: Styles.globalColors.black_75,
    fontSize: 15,
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

// TODO kill this when we remove the old markdown parser. This check is done at the parsing level.
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

const reactComponentsForMarkdownType = {
  // On mobile we can't have raw text without a Text tag. So we make sure we are in a paragraph or we return a new text tag. If it's not mobile we can short circuit and just return the string
  blockQuote: (node, output, state) => (
    <Box key={state.key} style={quoteStyle}>
      {output(node.content, {...state, inBlockQuote: true})}
    </Box>
  ),
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
  del: (node, output, state) => {
    return (
      <Text
        type="Body"
        key={state.key}
        style={Styles.collapseStyles([strikeStyle, state.styleOverride.del])}
        allowFontScaling={state.allowFontScaling}
      >
        {output(node.content, state)}
      </Text>
    )
  },
  em: (node, output, state) => {
    return (
      <Text type="Body" key={state.key} style={Styles.collapseStyles([italicStyle, state.styleOverride.em])}>
        {output(node.content, state)}
      </Text>
    )
  },
  emoji: (node, output, state) => {
    return <Emoji emojiName={String(node.content).toLowerCase()} size={16} key={state.key} />
  },
  fence: (node, output, state) =>
    isMobile ? (
      <Box key={state.key} style={codeSnippetBlockStyle}>
        <Text
          type="Body"
          style={Styles.collapseStyles([codeSnippetBlockTextStyle, state.styleOverride.fence])}
          allowFontScaling={state.allowFontScaling}
        >
          {node.content}
        </Text>
      </Box>
    ) : (
      <Text
        key={state.key}
        type="Body"
        style={Styles.collapseStyles([codeSnippetBlockStyle, state.styleOverride.fence])}
      >
        {node.content}
      </Text>
    ),
  inlineCode: (node, output, state) => {
    return (
      <Text
        type="Body"
        key={state.key}
        style={Styles.collapseStyles([codeSnippetStyle, state.styleOverride.inlineCode])}
        allowFontScaling={state.allowFontScaling}
      >
        {node.content}
      </Text>
    )
  },
  kbfsPath: (node, output, state) => {
    return <KbfsPath escapedPath={node.content} key={state.key} allowFontScaling={state.allowFontScaling} />
  },
  link: (node, output, state) => {
    const {protocol, afterProtocol, spaceInFront} = node
    const rawURL = protocol + afterProtocol
    const url = (protocol || 'http://') + afterProtocol

    return (
      <React.Fragment key={state.key}>
        {spaceInFront}
        <Text
          className="hover-underline"
          type="BodyPrimaryLink"
          style={Styles.collapseStyles([linkStyle, state.styleOverride.link])}
          title={url}
          onClickURL={url}
          onLongPressURL={url}
        >
          {rawURL}
        </Text>
      </React.Fragment>
    )
  },
  mailto: (node, output, state) => {
    return (
      <React.Fragment key={state.key}>
        {node.spaceInFront}
        <Text
          className="hover-underline"
          type="BodyPrimaryLink"
          style={Styles.collapseStyles([linkStyle, state.styleOverride.mailto])}
          title={node.content}
          onClickURL={node.mailto}
          onLongPressURL={node.mailto}
        >
          {node.content}
        </Text>
      </React.Fragment>
    )
  },
  mention: (node, output, state) => {
    return (
      <Mention
        username={node.content}
        key={state.key}
        style={wrapStyle}
        allowFontScaling={state.allowFontScaling}
      />
    )
  },
  newline: (node, output, state) =>
    !isMobile || state.inParagraph ? (
      '\n'
    ) : (
      <Text
        type="Body"
        key={state.key}
        style={Styles.collapseStyles([textBlockStyle, state.styleOverride.paragraph])}
        allowFontScaling={state.allowFontScaling}
      >
        {'\n'}
      </Text>
    ),
  paragraph: (node, output, state) => {
    return (
      <Text
        type="Body"
        key={state.key}
        style={Styles.collapseStyles([textBlockStyle, state.styleOverride.paragraph])}
        allowFontScaling={state.allowFontScaling}
      >
        {output(node.content, {...state, inParagraph: true})}
      </Text>
    )
  },
  serviceDecoration: (node, output, state) => {
    const {markdownMeta} = state
    if (!markdownMeta) {
      throw new Error('markdownMeta unexpectedly empty')
    }
    const {message} = markdownMeta

    return (
      <ServiceDecoration
        json={node.content}
        key={state.key}
        allowFontScaling={state.allowFontScaling}
        message={message}
      />
    )
  },
  strong: (node, output, state) => {
    return (
      <Text
        type="BodySemibold"
        key={state.key}
        style={Styles.collapseStyles([boldStyle, state.styleOverride.strong])}
        allowFontScaling={state.allowFontScaling}
      >
        {output(node.content, state)}
      </Text>
    )
  },
  text: SimpleMarkdown.defaultRules.text.react,
}

type State = {
  allowFontScaling?: boolean,
  inBlockQuote?: boolean,
  inParagraph?: boolean,
  key?: string,
  markdownMeta: ?MarkdownMeta,
  styleOverride: StyleOverride,
}

// Ideally this would be a discriminated union keyed by type.
type SingleASTNode = {
  type: string,
  [string]: any,
}

// The types below are adapted from the simple-markdown types.

type ASTNode = SingleASTNode | Array<SingleASTNode>

type Output<Result> = (node: ASTNode, state?: ?State) => Result

type NodeOutput<Result> = (node: SingleASTNode, nestedOutput: Output<Result>, state: State) => Result

type ReactElements = React$Node

type ReactNodeOutput = NodeOutput<ReactElements>

const ruleOutput = (rules: {text: NodeOutput<string>, [key: string]: ReactNodeOutput}) => (
  node,
  output,
  state
) => rules[node.type](node, output, state)

const bigEmojiOutput = SimpleMarkdown.reactFor(
  ruleOutput({
    ...reactComponentsForMarkdownType,
    emoji: (node, output, state) => {
      return (
        <Emoji
          emojiName={String(node.content)}
          size={32}
          key={state.key}
          allowFontScaling={state.allowFontScaling}
        />
      )
    },
    paragraph: (node, output, state) => (
      <Text type="Body" key={state.key} style={bigTextBlockStyle} allowFontScaling={state.allowFontScaling}>
        {output(node.content, {...state, inParagraph: true})}
      </Text>
    ),
  })
)

// TODO: Fix the typing here. Can ast actually be a non-object? Can
// output actually only return strings?
const previewOutput = SimpleMarkdown.reactFor(
  (ast: SingleASTNode, output: Output<string>, state: State): ReactElements => {
    // leaf node is just the raw value, so it has no ast.type
    if (typeof ast !== 'object') {
      return ast
    }

    switch (ast.type) {
      case 'emoji':
        return reactComponentsForMarkdownType.emoji(ast, output, state)
      case 'newline':
        return ' '
      case 'blockQuote':
        return '> ' + output(ast.content, state)
      case 'codeBlock':
        return ' ' + output(ast.content, state)
      default:
        return output(ast.content, state)
    }
  }
)

const reactOutput = SimpleMarkdown.reactFor(ruleOutput(reactComponentsForMarkdownType))

export {EmojiIfExists, bigEmojiOutput, markdownStyles, previewOutput, reactOutput}
