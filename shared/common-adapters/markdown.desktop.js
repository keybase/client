// @flow
import React, {PureComponent} from 'react'
import Text from './text'
import * as Styles from '../styles'
import * as Types from '../constants/types/chat2'
import Channel from './channel-container'
import Mention from './mention-container'
import Box from './box'
import Emoji from './emoji'
import {parseMarkdown, EmojiIfExists} from './markdown.shared'
import {emojiRegex} from '../markdown/emoji'
import SimpleMarkdown from 'simple-markdown'
import tlds from 'tlds'

import type {Props} from './markdown'

const wrapStyle = Styles.platformStyles({
  isElectron: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
})

const codeSnippetStyle = {
  ...Styles.globalStyles.fontTerminal,
  ...Styles.globalStyles.rounded,
  ...wrapStyle,
  backgroundColor: Styles.globalColors.beige,
  color: Styles.globalColors.blue,
  fontSize: 12,
  paddingLeft: Styles.globalMargins.xtiny,
  paddingRight: Styles.globalMargins.xtiny,
}

const codeSnippetBlockStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
    ...codeSnippetStyle,
    backgroundColor: Styles.globalColors.beige,
    color: Styles.globalColors.black_75,
    marginBottom: Styles.globalMargins.xtiny,
    marginTop: Styles.globalMargins.xtiny,
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
  isElectron: {
    display: 'block',
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
})
const neutralPreviewStyle = Styles.platformStyles({
  isElectron: {color: 'inherit', fontWeight: 'inherit'},
})
const boldStyle = {...wrapStyle, color: 'inherit'}
const italicStyle = Styles.platformStyles({
  common: {
    ...wrapStyle,
  },
  isElectron: {color: 'inherit', fontStyle: 'italic', fontWeight: 'inherit'},
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
})
const quoteStyle = {
  borderLeft: `3px solid ${Styles.globalColors.lightGrey2}`,
  paddingLeft: Styles.globalMargins.small,
}

function previewCreateComponent(type, key, children, options) {
  switch (type) {
    case 'emoji':
      return <EmojiIfExists emojiName={String(children)} size={12} key={key} />
    case 'native-emoji':
      return <Emoji emojiName={String(children)} size={12} key={key} />
    default:
      return (
        <Text type="BodySmall" key={key} style={neutralPreviewStyle}>
          {children}
        </Text>
      )
  }
}

function messageCreateComponent(type, key, children, options) {
  switch (type) {
    case 'markup':
      return <Box key={key}>{children}</Box>
    case 'mention':
      const username = children[0]
      if (typeof username !== 'string') {
        throw new Error('username unexpectedly not string')
      }
      return <Mention username={username} key={key} style={wrapStyle} />
    case 'channel':
      const name = children[0]
      if (typeof name !== 'string') {
        throw new Error('name unexpectedly not string')
      }
      const convID = options.convID || ''
      if (typeof convID !== 'string') {
        throw new Error('convID unexpectedly not string')
      }
      return (
        <Channel name={name} convID={Types.stringToConversationIDKey(convID)} key={key} style={linkStyle} />
      )
    case 'inline-code':
      return (
        <Text type="Body" key={key} style={codeSnippetStyle}>
          {children}
        </Text>
      )
    case 'code-block':
      return (
        <Text type="Body" key={key} style={codeSnippetBlockStyle}>
          {children}
        </Text>
      )
    case 'link':
      return (
        <Text
          className="hover-underline"
          type="BodyPrimaryLink"
          key={key}
          style={linkStyle}
          onClickURL={options.href}
        >
          {children}
        </Text>
      )
    case 'text-block':
      return (
        <Text type="Body" key={key} style={textBlockStyle}>
          {children && children.length ? children : '\u200b'}
        </Text>
      )
    case 'phone':
      return (
        <Text type="Body" key={key} style={wrapStyle}>
          {children}
        </Text>
      )
    case 'bold':
      return (
        <Text type="BodySemibold" key={key} style={boldStyle}>
          {children}
        </Text>
      )
    case 'italic':
      return (
        <Text type="Body" key={key} style={italicStyle}>
          {children}
        </Text>
      )
    case 'strike':
      return (
        <Text type="Body" key={key} style={strikeStyle}>
          {children}
        </Text>
      )
    case 'emoji':
      return <EmojiIfExists emojiName={String(children)} size={options.bigEmoji ? 32 : 16} key={key} />
    case 'native-emoji':
      return <Emoji emojiName={String(children)} size={options.bigEmoji ? 32 : 16} key={key} />
    case 'quote-block':
      return (
        <Box key={key} style={quoteStyle}>
          {children}
        </Box>
      )
  }
}

// https://gist.github.com/dperini/729294
// const linkRegex = /^(?:(?:(?:https?):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?))(?::\d{2,5})?(?:[/?#]\S*)?/i
const linkRegex = /^( *)((https?:\/\/)?[\w-]+(\.[\w-]+)+\.?(:\d+)?(\/\S*)?)\b/i

// const tldExp = new RegExp(`^(http:\\/\\/|https:\\/\\/|\\w)+\\.(${tlds.join('|')})\\b`, 'i')
// const ipExp = new RegExp(/^\s*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)
// const linkMatch = (source, state, prevCapture) => {
// let match = tldExp.exec(source)
// if (!match) {
// // includes a valid tld?
// match = ipExp.exec(source)
// if (!match) {
// // ip?
// return null
// }
// }
// return match
// }

var debugAnyScopeRegex = function(regex) {
  var match = function(source, state) {
    console.log('[debug]: ', source, state, regex.exec(source))
    return regex.exec(source)
  }
  match.regex = regex
  return match
}

// const rules = {
// ...SimpleMarkdown.defaultRules,
// }

const rules = {
  newline: {
    // handle newlines, keep this to handle \n w/ other matchers
    ...SimpleMarkdown.defaultRules.newline,
    // original
    // match: blockRegex(/^(?:\n *)*\n/),
    // ours: handle \n inside text also
    match: debugAnyScopeRegex(/^\n/), // SimpleMarkdown.anyScopeRegex(/^\n/),
  },
  escape: {
    // handle escaped chars, keep this to handle escapes globally
    ...SimpleMarkdown.defaultRules.escape,
  },
  fence: {
    // aka the ``` code blocks
    ...SimpleMarkdown.defaultRules.fence,
    order: 0,
    // original:
    // match: SimpleMarkdown.blockRegex(/^ *(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n *)+\n/),
    // ours: three ticks (anywhere) and remove any newlines in front and one in back
    match: SimpleMarkdown.anyScopeRegex(/^```(?:\n)?((?:\\[\s\S]|[^\\])+?)```(?!`)(\n)?/),
    parse: function(capture, parse, state) {
      return {
        content: capture[1],
        lang: undefined,
        type: 'codeBlock',
      }
    },
  },
  inlineCode: {
    ...SimpleMarkdown.defaultRules.inlineCode,
    // original:
    // match: inlineRegex(/^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/),
    // ours: onlyh allow a single backtick
    match: SimpleMarkdown.inlineRegex(/^(`)(?!`)\s*([\s\S]*?[^`\n])\s*\1(?!`)/),
    react: (node, output, state) => {
      return (
        <Text type="Body" key={state.key} style={codeSnippetStyle}>
          {node.content}
        </Text>
      )
    },
  },
  codeBlock: {
    ...SimpleMarkdown.defaultRules.codeBlock,
    // original:
    // match: blockRegex(/^(?:    [^\n]+\n*)+(?:\n *)+\n/),
    // ours: we only want code blocks from fences (```) and not from spaces
    match: () => false,
    react: (node, output, state) => {
      return (
        <Text key={state.key} type="Body" style={codeSnippetBlockStyle}>
          {node.content}
        </Text>
      )
    },
  },
  paragraph: {
    ...SimpleMarkdown.defaultRules.paragraph,
    // original:
    // match: SimpleMarkdown.blockRegex(/^((?:[^\n]|\n(?! *\n))+)(?:\n *)+\n/),
    // ours: allow simple empty blocks
    match: SimpleMarkdown.blockRegex(/^((?:[^\n]|\n(?! *\n))+)\n/),
    react: (node, output, state) => {
      return (
        <Text type="Body" key={state.key} style={textBlockStyle}>
          {output(node.content, state)}
        </Text>
      )
    },
  },
  // },
  // // link: {
  // // ...SimpleMarkdown.defaultRules.link,
  // // react: (node, output, state) => {
  // // return (
  // // <Text
  // // className="hover-underline"
  // // type="BodyPrimaryLink"
  // // key={state.key}
  // // style={linkStyle}
  // // onClickURL={state.href}
  // // >
  // // {node.content}
  // // </Text>
  // // )
  // // },
  // // },
  // // textBlock: {
  // // ...SimpleMarkdown.defaultRules.textBlock,
  // // react: (node, output, state) => {
  // // return (
  // // <Text type="Body" key={state.key} style={textBlockStyle}>
  // // {node.content && node.content.length ? node.content : '\u200b'}
  // // </Text>
  // // )
  // // },
  // // },
  strong: {
    ...SimpleMarkdown.defaultRules.strong,
    // original
    // match: inlineRegex(/^\*\*((?:\\[\s\S]|[^\\])+?)\*\*(?!\*)/),
    // ours: single stars
    match: SimpleMarkdown.inlineRegex(/^\*((?:\\[\s\S]|[^\\])+?)\*(?!\*)/),
    react: (node, output, state) => {
      return (
        <Text type="BodySemibold" key={state.key} style={boldStyle}>
          {output(node.content, state)}
        </Text>
      )
    },
  },
  em: {
    ...SimpleMarkdown.defaultRules.em,
    // original is pretty long so not inlining it here
    // ours: wrapped in _'s
    match: SimpleMarkdown.inlineRegex(/^_((?:\\[\s\S]|[^\\])+?)_(?!_)/),
    react: (node, output, state) => {
      return (
        <Text type="Body" key={state.key} style={italicStyle}>
          {output(node.content, state)}
        </Text>
      )
    },
  },
  del: {
    ...SimpleMarkdown.defaultRules.del,
    // original:
    // match: inlineRegex(/^~~(?=\S)([\s\S]*?\S)~~/),
    // ours: single tidle doesn't cross a newline
    // match: SimpleMarkdown.inlineRegex(/^~((?:\\[\s\S]|[^\\])+?)~(?!~)/),
    match: SimpleMarkdown.inlineRegex(/^~((?:\\[\s\S]|[^\\\n])+?)~(?!~)/),
    react: (node, output, state) => {
      return (
        <Text type="Body" key={state.key} style={strikeStyle}>
          {output(node.content, state)}
        </Text>
      )
    },
  },
  blockQuote: {
    ...SimpleMarkdown.defaultRules.blockQuote,
    react: (node, output, state) => {
      return (
        <Box key={state.key} style={quoteStyle}>
          {output(node.content, state)}
        </Box>
      )
    },
  },
  text: {
    ...SimpleMarkdown.defaultRules.text,
  },
  emoji: {
    order: SimpleMarkdown.defaultRules.text.order - 0.5,
    match: SimpleMarkdown.inlineRegex(emojiRegex),
    parse: function(capture, parse, state) {
      return {content: capture[0]}
    },
    react: (node, output, state) => {
      // TODO support big emoji
      return <EmojiIfExists emojiName={String(node.content)} size={16} key={state.key} />
    },
  },
  link: {
    order: SimpleMarkdown.defaultRules.newline.order + 0.5,
    match: SimpleMarkdown.inlineRegex(linkRegex),
    parse: function(capture, parse, state) {
      return {spaceInFront: capture[1], content: capture[2]}
    },
    react: (node, output, state) => {
      return (
        <>
          {node.spaceInFront}
          <Text
            className="hover-underline"
            type="BodyPrimaryLink"
            key={state.key}
            style={linkStyle}
            title={node.content}
            onClickURL={node.content}
          >
            {node.content}
          </Text>
        </>
      )
    },
  },
}

const parser = SimpleMarkdown.parserFor(rules)
const reactOutput = SimpleMarkdown.reactFor(SimpleMarkdown.ruleOutput(rules, 'react'))

class Markdown extends PureComponent<Props> {
  render() {
    if (this.props.simple) {
      const parseTree = parser(this.props.children || '', {inline: false})
      console.log(parseTree)
      return (
        <div>
          <Text type="Body" style={Styles.collapseStyles([styles.rootWrapper, this.props.style])}>
            {reactOutput(parseTree)}
          </Text>
          <pre>{'\n\n\n--------'}</pre>
          <pre>{this.props.children}</pre>
          <pre>{JSON.stringify(parseTree, null, 2)}</pre>
        </div>
      )
    } else {
      const content = parseMarkdown(
        this.props.children,
        this.props.preview ? previewCreateComponent : messageCreateComponent,
        this.props.meta
      )
      return (
        <Text
          type="Body"
          style={Styles.platformStyles({isElectron: {whiteSpace: 'pre', ...this.props.style}})}
        >
          {content}
        </Text>
      )
    }
  }
}

const styles = Styles.styleSheetCreate({
  rootWrapper: Styles.platformStyles({
    isElectron: {
      whiteSpace: 'pre',
    },
  }),
})

export default Markdown
