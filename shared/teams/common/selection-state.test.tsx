/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import {act, cleanup, renderHook} from '@testing-library/react'
import type * as T from '@/constants/types'
import {
  ChannelSelectionProvider,
  TeamSelectionProvider,
  useChannelSelectionState,
  useTeamSelectionState,
} from './selection-state'

afterEach(() => {
  cleanup()
})

const conversationIDKey1 = '1' as T.Chat.ConversationIDKey
const conversationIDKey2 = '2' as T.Chat.ConversationIDKey

const last = <T,>(items: Array<T>) => items[items.length - 1]

const setupTeamWrapper = ({
  initialSelectedChannels,
  initialSelectedMembers,
}: {
  initialSelectedChannels?: Array<T.Chat.ConversationIDKey>
  initialSelectedMembers?: Array<string>
}) => {
  const selectedChannelChanges: Array<Array<T.Chat.ConversationIDKey> | undefined> = []
  const selectedMemberChanges: Array<Array<string> | undefined> = []

  const Wrapper = ({children}: {children: React.ReactNode}) => {
    const [selectedChannels, setSelectedChannels] = React.useState<
      Array<T.Chat.ConversationIDKey> | undefined
    >(initialSelectedChannels)
    const [selectedMembers, setSelectedMembers] = React.useState<Array<string> | undefined>(
      initialSelectedMembers
    )

    return (
      <TeamSelectionProvider
        selectedChannels={selectedChannels}
        selectedMembers={selectedMembers}
        onSelectedChannelsChange={nextSelectedChannels => {
          selectedChannelChanges.push(nextSelectedChannels)
          setSelectedChannels(nextSelectedChannels)
        }}
        onSelectedMembersChange={nextSelectedMembers => {
          selectedMemberChanges.push(nextSelectedMembers)
          setSelectedMembers(nextSelectedMembers)
        }}
      >
        {children}
      </TeamSelectionProvider>
    )
  }

  return {Wrapper, selectedChannelChanges, selectedMemberChanges}
}

const setupChannelWrapper = ({initialSelectedMembers}: {initialSelectedMembers?: Array<string>}) => {
  const selectedMemberChanges: Array<Array<string> | undefined> = []

  const Wrapper = ({children}: {children: React.ReactNode}) => {
    const [selectedMembers, setSelectedMembers] = React.useState<Array<string> | undefined>(
      initialSelectedMembers
    )

    return (
      <ChannelSelectionProvider
        selectedMembers={selectedMembers}
        onSelectedMembersChange={nextSelectedMembers => {
          selectedMemberChanges.push(nextSelectedMembers)
          setSelectedMembers(nextSelectedMembers)
        }}
      >
        {children}
      </ChannelSelectionProvider>
    )
  }

  return {Wrapper, selectedMemberChanges}
}

test('team selection provider keeps add remove and clear behavior in sync with route params', () => {
  const {selectedChannelChanges, selectedMemberChanges, Wrapper} = setupTeamWrapper({
    initialSelectedChannels: [conversationIDKey1],
    initialSelectedMembers: ['alice'],
  })
  const {result} = renderHook(() => useTeamSelectionState(), {wrapper: Wrapper})

  expect([...result.current.selectedMembers]).toEqual(['alice'])
  expect([...result.current.selectedChannels]).toEqual([conversationIDKey1])

  act(() => {
    result.current.setMemberSelected('alice', true)
  })
  expect(last(selectedMemberChanges)).toEqual(['alice'])
  expect([...result.current.selectedMembers]).toEqual(['alice'])

  act(() => {
    result.current.setMemberSelected('bob', true)
  })
  expect(last(selectedMemberChanges)).toEqual(['alice', 'bob'])
  expect([...result.current.selectedMembers]).toEqual(['alice', 'bob'])

  act(() => {
    result.current.setMemberSelected('alice', false)
  })
  expect(last(selectedMemberChanges)).toEqual(['bob'])
  expect([...result.current.selectedMembers]).toEqual(['bob'])

  act(() => {
    result.current.setMemberSelected('bob', false)
  })
  expect(last(selectedMemberChanges)).toBeUndefined()
  expect([...result.current.selectedMembers]).toEqual([])

  act(() => {
    result.current.setChannelSelected(conversationIDKey2, true)
  })
  expect(last(selectedChannelChanges)).toEqual([conversationIDKey1, conversationIDKey2])
  expect([...result.current.selectedChannels]).toEqual([conversationIDKey1, conversationIDKey2])

  act(() => {
    result.current.setChannelSelected(conversationIDKey2, false, true)
  })
  expect(last(selectedChannelChanges)).toBeUndefined()
  expect([...result.current.selectedChannels]).toEqual([])

  act(() => {
    result.current.clearSelectedMembers()
    result.current.clearSelectedChannels()
  })
  expect(last(selectedMemberChanges)).toBeUndefined()
  expect(last(selectedChannelChanges)).toBeUndefined()
})

test('channel selection provider clears empty selections back to undefined', () => {
  const {selectedMemberChanges, Wrapper} = setupChannelWrapper({initialSelectedMembers: ['alice']})
  const {result} = renderHook(() => useChannelSelectionState(), {wrapper: Wrapper})

  expect([...result.current.selectedMembers]).toEqual(['alice'])

  act(() => {
    result.current.setMemberSelected('bob', true)
  })
  expect(last(selectedMemberChanges)).toEqual(['alice', 'bob'])
  expect([...result.current.selectedMembers]).toEqual(['alice', 'bob'])

  act(() => {
    result.current.setMemberSelected('alice', false)
    result.current.setMemberSelected('bob', false)
  })
  expect(last(selectedMemberChanges)).toBeUndefined()
  expect([...result.current.selectedMembers]).toEqual([])

  act(() => {
    result.current.setMemberSelected('carol', true)
  })
  expect(last(selectedMemberChanges)).toEqual(['carol'])

  act(() => {
    result.current.clearSelectedMembers()
  })
  expect(last(selectedMemberChanges)).toBeUndefined()
  expect([...result.current.selectedMembers]).toEqual([])
})
