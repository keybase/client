// @flow

import Text from './text'
import React from 'react'
import {List} from 'immutable'

import type {Props} from './markdown'
import type {PropsOf} from '../constants/types/more'

// Order matters, since we want to match the longer ticks first
const openToClosePair = {
  '```': '```',
  '`': '`',
  '*': '*',
  '_': '_',
  '~': '~',
}

type TagInfo<C> = {Component: Class<C>, props: PropsOf<C>}

const initialOpenToTag = {
  '`': {Component: Text, props: {type: 'CodeSnippet', style: {}}},
  '```': {Component: Text, props: {type: 'CodeSnippetBlock'}},
  '*': {Component: Text, props: {type: 'BodySemibold'}},
  '_': {Component: Text, props: {type: 'BodyInherit', style: {fontStyle: 'italic'}}},
  '~': {Component: Text, props: {type: 'BodyInherit', style: {textDecoration: 'line-through'}}},
}

const openToNextOpenToTag = {
  '`': {},
  '```': {},
  '*': initialOpenToTag,
  '_': initialOpenToTag,
  '~': initialOpenToTag,
}

const plainStringTag = {Component: Text, props: {type: 'Body'}}

type TagMeta = {
  componentInfo: {Component: ReactClass<*>, props: Object},
  textSoFar: string,
  elementsSoFar: List<React$Element<*> | string>,
  openToTag: {[key: string]: TagInfo<*>},
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

function matchWithMark (text: string): ?{matchingMark: string, restText: string} {
  const matchingMark = Object.keys(openToClosePair).find(mark => text.indexOf(mark) === 0)
  return matchingMark ? {matchingMark, restText: text.slice(matchingMark.length)} : null
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
  } else if (matchingMark && openToTag[matchingMark]) {
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
      return _parseRecursive(text.slice(2), tagStack.update(-1, m => ({...m, textSoFar: m.textSoFar + text.slice(1, 2)})), key)
    } else {
      return _parseRecursive(restText, tagStack.update(-1, m => ({...m, textSoFar: m.textSoFar + firstChar})), key)
    }
  }
}

const Markdown = ({children}: Props) => {
  return <Text type='Body'>{_parseRecursive(children || '', new List([initalTagMeta]), 0)}</Text>
}

export default Markdown
