// @flow

import Text from './text'
import Emoji from './emoji'
import React, {PureComponent} from 'react'
import {List} from 'immutable'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props} from './markdown'
import type {PropsOf} from '../constants/types/more'

type TagInfo<C> = {Component: Class<C>, props: PropsOf<C>}

const codeSnippetStyle = {
  ...globalStyles.fontTerminal,
  ...globalStyles.rounded,
  fontSize: 12,
  paddingLeft: globalMargins.xtiny,
  paddingRight: globalMargins.xtiny,
  backgroundColor: globalColors.beige,
  color: globalColors.blue,
}

const codeSnippetBlockStyle = {
  ...codeSnippetStyle,
  display: 'block',
  color: globalColors.black_75,
  backgroundColor: globalColors.beige,
  marginTop: globalMargins.xtiny,
  marginBottom: globalMargins.xtiny,
  paddingTop: globalMargins.xtiny,
  paddingBottom: globalMargins.xtiny,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  whiteSpace: 'pre',
}

// Order matters, since we want to match the longer ticks first
const openToClosePair = {
  '```': '```',
  '`': '`',
  '*': '*',
  '_': '_',
  '~': '~',
  ':': ':',
}

// We have to escape certain marks when turning them into a regex
const markToRegex = {
  '```': '```',
  '`': '`',
  '*': '\\*',
  '_': '_',
  '~': '~',
  ':': ':',
}

const initialOpenToTag = {
  '`': {Component: Text, props: {type: 'Body', style: codeSnippetStyle}},
  '```': {Component: Text, props: {type: 'Body', style: codeSnippetBlockStyle}},
  '*': {Component: Text, props: {type: 'BodySemibold', style: {color: undefined}}},
  '_': {Component: Text, props: {type: 'Body', style: {fontStyle: 'italic', fontWeight: undefined, color: undefined}}},
  '~': {Component: Text, props: {type: 'Body', style: {textDecoration: 'line-through', fontWeight: undefined, color: undefined}}},
  ':': {Component: Emoji, props: {size: 16}},
}

const openToNextOpenToTag = {
  '`': {},
  '```': {},
  '*': initialOpenToTag,
  '_': initialOpenToTag,
  '~': initialOpenToTag,
  ':': {},
}

const plainStringTag = {Component: Text, props: {type: 'Body', style: {color: undefined}}}

type TagMeta = {
  componentInfo: {Component: ReactClass<*>, props: Object},
  textSoFar: string,
  elementsSoFar: List<React$Element<*> | string>,
  openToTag: {[key: string]: TagInfo<Text> | TagInfo<Emoji>},
  closingTag: ?string,
}

const initalTagMeta: TagMeta = {
  componentInfo: plainStringTag,
  textSoFar: '',
  elementsSoFar: new List(),
  openToTag: initialOpenToTag,
  closingTag: null,
}

type TagStack = List<TagMeta>

const marksRegex = new RegExp(Object.keys(openToClosePair).map(s => '^' + markToRegex[s]).join('|'))
function matchWithMark (text: string): ?{matchingMark: string, restText: string} {
  const m = text.match(marksRegex)
  if (m && m[0]) {
    const matchingMark = m[0]
    return {matchingMark, restText: text.slice(matchingMark.length)}
  }
  return null
}

function hasClosingMark (text: string, openingMark): boolean {
  const closingMark = openToClosePair[openingMark]
  return text.indexOf(closingMark, openingMark.length) !== -1
}

function tagMetaToElement (m: TagMeta, key) {
  const {textSoFar, elementsSoFar, componentInfo: {Component, props}} = m
  return <Component key={key} {...props}>{elementsSoFar.push(textSoFar).toArray()}</Component>
}

function _parseRecursive (text: string, tagStack: TagStack, key: number): React$Element<*> {
  if (text.length === 0 && tagStack.count() < 1) {
    throw new Error('Messed up parsing markdown text')
  }

  if (text.length === 0 && tagStack.count() === 1) {
    return tagMetaToElement(tagStack.last(), key)
  }

  const topTag = tagStack.last()

  const {openToTag, closingTag} = topTag
  const firstChar = text[0]
  const match = matchWithMark(text)
  const restText = match ? match.restText : text.slice(1)
  const matchingMark: ?string = match && match.matchingMark

  if (text.length === 0 || closingTag && closingTag === matchingMark) {
    const newElement = tagMetaToElement(topTag, key)
    return _parseRecursive(
      restText,
      tagStack.pop().update(-1, m => ({...m, elementsSoFar: m.elementsSoFar.push(newElement)})),
      key + 1
    )
  } else if (matchingMark && openToTag[matchingMark] && hasClosingMark(text, matchingMark)) {
    return _parseRecursive(
      restText,
      tagStack
        .update(-1, m => ({...m, textSoFar: '', elementsSoFar: m.elementsSoFar.push(m.textSoFar)}))
        .push({
          componentInfo: openToTag[matchingMark],
          closingTag: openToClosePair[matchingMark],
          textSoFar: '',
          elementsSoFar: new List(),
          openToTag: openToNextOpenToTag[matchingMark] || {},
        }),
      key
    )
  } else {
    if (firstChar === '\\') {
      return _parseRecursive(text.slice(2), tagStack.update(-1, m => ({...m, textSoFar: m.textSoFar + text[1]})), key)
    } else {
      return _parseRecursive(restText, tagStack.update(-1, m => ({...m, textSoFar: m.textSoFar + firstChar})), key)
    }
  }
}

// It's a lot easier to parse emojis if we change :santa::skin-tone-3: to :santa\:\:skin-tone-3:
function preprocessEmojiColors (text: string): string {
  return text.replace(/:([\w-]*)::(skin-tone-\d):/g, ':$1\\:\\:$2:')
}

const initialTagStack = new List([initalTagMeta])

class Markdown extends PureComponent<void, Props, void> {
  render () {
    return <Text type='Body' style={this.props.style}>{_parseRecursive(preprocessEmojiColors(this.props.children || ''), initialTagStack, 0)}</Text>
  }
}

export default Markdown
