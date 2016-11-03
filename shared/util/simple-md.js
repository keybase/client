// @flow

import {Text} from '../common-adapters'
import React from 'react'
import * as Immutable from 'immutable'

const {List} = Immutable

const openToClosePair = {
  '`': '`',
}

const openToTag = {
  '`': {Component: Text, props: {type: 'Terminal'}},
}

type TagStack = List<{
  type: 'component',
  componentInfo: {Component: ReactClass<*>, props: Object},
  textSoFar: string,
  closingTag: string,
} | {type: 'plainString', textSoFar: string}>

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
  const restText = text.slice(1)

  if (topTag && topTag.type === 'component' && topTag.closingTag === firstChar) {
    const {textSoFar, componentInfo: {Component, props}} = topTag
    return _parseRecursive(restText, tagStack.pop(), key + 1, elements.push(<Component key={key} {...props}>{textSoFar}</Component>))
  } else if (openToTag[firstChar]) {
    return _parseRecursive(
      restText,
      (topTag.type === 'plainString' ? tagStack.pop() : tagStack).push({
        type: 'component',
        componentInfo: openToTag[firstChar],
        closingTag: openToClosePair[firstChar],
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

function parseMarkdown (text: string): React$Element<*> {
  return <Text type='Body'>{_parseRecursive(text, new List(), 0, new List())}</Text>
}
export default parseMarkdown
