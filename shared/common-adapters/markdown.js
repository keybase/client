// @flow

import Text from './text'
import React from 'react'
import {List} from 'immutable'

import type {Props} from './markdown'

// Order matters, since we want to match the longer ticks first
const openToClosePair = {
  '```': '```',
  '`': '`',
  '*': '*',
  '_': '_',
  '~': '~',
}

const openToTag = {
  '`': {Component: Text, props: {type: 'CodeSnippet', style: {}}},
  '```': {Component: Text, props: {type: 'CodeSnippetBlock'}},
  '*': {Component: Text, props: {type: 'BodySemibold'}},
  '_': {Component: Text, props: {type: 'Body', style: {fontStyle: 'italic'}}},
  '~': {Component: Text, props: {type: 'Body', style: {textDecoration: 'line-through'}}},
}

type TagStack = List<{
  type: 'component',
  componentInfo: {Component: ReactClass<*>, props: Object},
  textSoFar: string,
  closingTag: string,
} | {type: 'plainString', textSoFar: string}>

function matchWithMark (text: string): ?{matchingMark: string, restText: string} {
  const matchingMark = Object.keys(openToClosePair).find(mark => text.indexOf(mark) === 0)
  return matchingMark ? {matchingMark, restText: text.slice(matchingMark.length)} : null
}

function _parseRecursive (text: string, tagStack: TagStack, key: number, elements: List<React$Element<*> | string>): Array<React$Element<*>> {
  if (text.length === 0) {
    if (tagStack.count() === 1) {
      return elements.push(tagStack.last().textSoFar).toJS()
    } else if (tagStack.count() > 1) {
      console.warn('invalid markdown trying my best:', text)
    } else {
      return elements.toJS()
    }
  }

  const topTag = tagStack.last()
  const firstChar = text[0]

  const match = matchWithMark(text)
  const restText = match ? match.restText : text.slice(1)
  const matchingMark: ?string = match && match.matchingMark

  if (topTag && topTag.type === 'component' && topTag.closingTag === matchingMark) {
    const {textSoFar, componentInfo: {Component, props}} = topTag
    return _parseRecursive(restText, tagStack.pop(), key + 1, elements.push(<Component key={key} {...props}>{textSoFar}</Component>))
  } else if (matchingMark && openToTag[matchingMark]) {
    return _parseRecursive(
      restText,
      (topTag.type === 'plainString' ? tagStack.pop() : tagStack).push({
        type: 'component',
        componentInfo: openToTag[matchingMark],
        closingTag: openToClosePair[matchingMark],
        textSoFar: '',
      }),
      key,
      topTag.type === 'plainString' ? elements.push(topTag.textSoFar) : elements
    )
  } else if (topTag) {
    return _parseRecursive(
      restText,
      // $FlowIssue
      tagStack.pop().push({...topTag, textSoFar: topTag.textSoFar + firstChar}),
      key,
      elements
    )
  } else {
    return _parseRecursive(
      restText,
      tagStack.push({
        type: 'plainString',
        textSoFar: firstChar,
      }),
      key,
      elements
    )
  }
}

const Markdown = ({children}: Props) => {
  return <Text type='Body'>{_parseRecursive(children || '', new List(), 0, new List())}</Text>
}

export default Markdown
