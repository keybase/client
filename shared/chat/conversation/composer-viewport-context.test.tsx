/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import {render} from '@testing-library/react'
import {
  ComposerBoxContext,
  ComposerProvider,
  useComposerAnchor,
  type ComposerAnchor,
} from './composer-viewport-context'
import {computeComposerBox} from './composer-geometry'

// The composer's geometry is published as two contexts so that consumers only
// re-render for what they read. The message list reads the anchor alone, and the
// anchor must survive every measurement of the conversation box: merging these
// back into one context costs an extra list render on every mount and rotation.

type Probe = {renders: number}

const makeProbe = (read: () => void) => {
  const probe: Probe = {renders: 0}
  const Component = React.memo(function Component() {
    probe.renders++
    read()
    return null
  })
  return {Component, probe}
}

// stands in for the reanimated shared values, which are created once and keep
// their identity for the life of the conversation
const stableShared = {value: 0} as ComposerAnchor['keyboardHeight']

type ConversationProps = {
  measuredHeight: number
  bottomInset: number
  children: React.ReactNode
}

const Conversation = ({measuredHeight, bottomInset, children}: ConversationProps) => (
  <ComposerProvider
    bottomInset={bottomInset}
    keyboardHeight={stableShared}
    keyboardProgress={stableShared}
    measuredHeight={measuredHeight}
  >
    {children}
  </ComposerProvider>
)

test('measuring the conversation box does not re-render anchor-only consumers', () => {
  let seenBottomInset = -1
  let seenVisibleHeight = -1
  const anchorOnly = makeProbe(() => {
    seenBottomInset = useComposerAnchor().bottomInset
  })
  const boxOnly = makeProbe(() => {
    seenVisibleHeight = React.useContext(ComposerBoxContext).visibleHeight
  })
  const probes = (
    <>
      <anchorOnly.Component />
      <boxOnly.Component />
    </>
  )

  const {rerender} = render(
    <Conversation bottomInset={34} measuredHeight={0}>
      {probes}
    </Conversation>
  )
  expect(anchorOnly.probe.renders).toBe(1)
  expect(boxOnly.probe.renders).toBe(1)
  expect(seenVisibleHeight).toBe(0)

  // first layout: the box is measured, the anchor is untouched
  rerender(
    <Conversation bottomInset={34} measuredHeight={753}>
      {probes}
    </Conversation>
  )
  expect(boxOnly.probe.renders).toBe(2)
  expect(seenVisibleHeight).toBe(753)
  expect(anchorOnly.probe.renders).toBe(1)

  // a re-measure to the same height must not churn either
  rerender(
    <Conversation bottomInset={34} measuredHeight={753}>
      {probes}
    </Conversation>
  )
  expect(boxOnly.probe.renders).toBe(2)
  expect(anchorOnly.probe.renders).toBe(1)

  // but a real inset change does reach the anchor, and only the anchor
  rerender(
    <Conversation bottomInset={0} measuredHeight={753}>
      {probes}
    </Conversation>
  )
  expect(anchorOnly.probe.renders).toBe(2)
  expect(seenBottomInset).toBe(0)
  expect(boxOnly.probe.renders).toBe(2)
})

test('the composer panels see their sizes on first layout and after rotation', () => {
  let box = computeComposerBox(1)
  const panels = makeProbe(() => {
    box = React.useContext(ComposerBoxContext)
  })

  const {rerender} = render(
    <Conversation bottomInset={34} measuredHeight={0}>
      <panels.Component />
    </Conversation>
  )
  expect(box.visibleHeight).toBe(0)
  expect(box.commandMarkdownMaxHeight).toBe(250)
  expect(box.expandedSuggestionListHeight).toBe(0)

  rerender(
    <Conversation bottomInset={34} measuredHeight={753}>
      <panels.Component />
    </Conversation>
  )
  expect(box.visibleHeight).toBe(753)
  expect(box.commandMarkdownMaxHeight).toBe(263)
  expect(box.expandedSuggestionListHeight).toBe(240)

  // rotation: a shorter box shrinks both panels
  rerender(
    <Conversation bottomInset={34} measuredHeight={300}>
      <panels.Component />
    </Conversation>
  )
  expect(box.commandMarkdownMaxHeight).toBe(105)
  expect(box.expandedSuggestionListHeight).toBe(116)
})

test('the box default outside a conversation is the pre-layout box', () => {
  // the desktop command-markdown panel reads the box with no provider above it
  let box = computeComposerBox(1)
  const outside = makeProbe(() => {
    box = React.useContext(ComposerBoxContext)
  })
  render(<outside.Component />)

  expect(box).toEqual(computeComposerBox(0))
  expect(box.commandMarkdownMaxHeight).toBe(250)
})

test('reading the anchor outside a conversation throws instead of faking a keyboard', () => {
  const outside = makeProbe(() => {
    useComposerAnchor()
  })
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => render(<outside.Component />)).toThrow(/inside a ComposerProvider/)
  spy.mockRestore()
})
