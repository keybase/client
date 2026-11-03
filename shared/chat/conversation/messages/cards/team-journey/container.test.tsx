/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'

// each button's first onClick (the wave button's onWave, as 'Wave'): the handler a screen kept
// through an account switch still holds
const mockFirstOnClick = new Map<string, () => void>()
// the card's team avatar needs the local http server, which a test does not run
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<{
    Button: React.ComponentType<{label?: string; onClick?: () => void}>
    WaveButton: React.ComponentType<{onWave: () => void}>
  }>('@/common-adapters')
  const R = jest.requireActual<typeof React>('react')
  return {
    ...actual,
    Avatar: () => null,
    Button: (p: {label?: string; onClick?: () => void}) => {
      if (p.label && p.onClick && !mockFirstOnClick.has(p.label)) {
        mockFirstOnClick.set(p.label, p.onClick)
      }
      return R.createElement(actual.Button, p)
    },
    WaveButton: (p: {onWave: () => void}) => {
      if (!mockFirstOnClick.has('Wave')) {
        mockFirstOnClick.set('Wave', p.onWave)
      }
      return R.createElement(actual.WaveButton, p)
    },
  }
})

import * as Meta from '@/constants/chat/meta'
import {useEffect} from 'react'
import {makeMessageJourneycard} from '@/constants/chat/message'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {metasReceived} from '@/chat/inbox/metadata'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'
import {LoadedTeamsListProvider} from '@/teams/use-teams-list'
import {ConversationThreadProvider, useConversationThreadActions} from '../../../thread-context'
import TeamJourney from './container'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const teamID = 'aabbccdd'
const postText = 'chat.1.local.postTextNonblock'
const getAnnotatedTeam = 'keybase.1.teams.getAnnotatedTeam'
const setShowcase = 'keybase.1.teams.setTeamMemberShowcase'

let fake: FakeEngine

const AddCard = () => {
  const {addMessages} = useConversationThreadActions()
  useEffect(() => {
    addMessages([
      makeMessageJourneycard({
        cardType: T.RPCChat.JourneycardType.welcome,
        conversationIDKey,
        ordinal: T.Chat.numberToOrdinal(1),
      }),
    ])
  }, [addMessages])
  return null
}

const renderCard = async () => {
  const {wrapper: Nav} = navigationWrapper({params: {conversationIDKey}, route: 'chatRoot'})
  render(
    <Nav>
      <LoadedTeamsListProvider>
        <ConversationThreadProvider id={conversationIDKey}>
          <AddCard />
          <TeamJourney ordinal={T.Chat.numberToOrdinal(1)} />
        </ConversationThreadProvider>
      </LoadedTeamsListProvider>
    </Nav>
  )
  await flush()
}

const click = async (text: string) => {
  act(() => {
    fireEvent.click(screen.getByText(text))
  })
  await flush()
}

beforeEach(() => {
  mockFirstOnClick.clear()
  fake = installFakeEngine()
  // the teams list the app's provider loads, with the one team this card is in
  fake.answer('keybase.1.teams.teamListUnverified', () => ({
    teams: [
      {
        allowProfilePromote: true,
        fqName: 'testteam',
        isMemberShowcased: false,
        isOpenTeam: false,
        memberCount: 2,
        role: T.RPCGen.TeamRole.writer,
        teamID,
      },
    ],
  }))
  fake.answer('keybase.1.teams.getTeamRoleMap', () => ({teams: {}, version: 1}))
  fake.answer(postText, () => {})
  fake.answer(setShowcase, () => {})
  // the card's channel lookup still loads the team (see the failing test below); left in flight
  fake.hold(getAnnotatedTeam)
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  metasReceived(
    [
      {
        ...Meta.makeConversationMeta(),
        channelname: 'general',
        conversationIDKey,
        teamID,
        teamname: 'testteam',
        teamType: 'small',
        tlfname: 'testteam',
      },
    ],
    undefined,
    {force: true}
  )
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('the welcome card waves a plain wave into the conversation', async () => {
  await renderCard()
  await click('Wave')
  expect(paramsOf(fake, postText)).toEqual([
    expect.objectContaining({
      body: ':wave:',
      clientPrev: 0,
      conversationID: T.Chat.keyToConversationID(conversationIDKey),
      tlfName: 'testteam',
      tlfPublic: false,
    }),
  ])
  expect(paramsOf(fake, postText)[0]).not.toHaveProperty('ephemeralLifetime')
})

test('the welcome card publishes the team on your profile once the teams list says it may', async () => {
  await renderCard()
  await click('Publish team on your profile')
  expect(paramsOf(fake, setShowcase)).toEqual([{isShowcased: true, teamID}])
})

// an account switch keeps the screen up until the provider rebuilds its thread for the next account
describe('a welcome card whose thread has retired', () => {
  test('waves nothing', async () => {
    await renderCard()
    act(() => {
      useCurrentUserState.getState().dispatch.setBootstrap({
        deviceID: 'device-id2',
        deviceName: 'testuser-mac',
        uid: 'uid2',
        username: 'testuser2',
      })
    })
    expect(mockFirstOnClick.has('Wave')).toBe(true)
    act(() => {
      mockFirstOnClick.get('Wave')?.()
    })
    await flush()
    expect(paramsOf(fake, postText)).toEqual([])
  })
})

// The welcome card shows no channels, so it passes dontCallRPC to useAllChannelMetas, yet the
// useLoadedTeam inside it still loads the whole annotated team for every card rendered.
test.failing('a welcome card asks the service for no team load', async () => {
  await renderCard()
  expect(paramsOf(fake, getAnnotatedTeam)).toEqual([])
})
