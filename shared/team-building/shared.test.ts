/// <reference types="jest" />
import type * as T from '@/constants/types'
import {allServices} from '@/constants/team-building'
import {
  getSearchResults,
  serviceIdToAccentColor,
  serviceIdToAvatarIcon,
  serviceIdToBadge,
  serviceIdToIconFont,
  serviceIdToLabel,
  serviceIdToLongLabel,
  serviceIdToSearchPlaceholder,
  serviceMapToArray,
} from './shared'

describe('service metadata', () => {
  test('every service in the tab bar has complete metadata', () => {
    for (const service of allServices) {
      expect(serviceIdToIconFont(service)).toMatch(/^iconfont-/)
      expect(serviceIdToLabel(service).length).toBeGreaterThan(0)
      expect(serviceIdToSearchPlaceholder(service).length).toBeGreaterThan(0)
      expect(serviceIdToLongLabel(service).filter(part => part.length > 0)).toHaveLength(2)
      expect(serviceIdToAccentColor(service, false)).toMatch(/^#[0-9a-fA-F]{3,6}$/)
    }
  })

  test('the tab bar labels are all distinct so the tabs are tellable apart', () => {
    const labels = allServices.map(serviceIdToLabel)
    expect(new Set(labels).size).toBe(allServices.length)
    const icons = allServices.map(serviceIdToIconFont)
    expect(new Set(icons).size).toBe(allServices.length)
  })

  test('only the assertion-creating services are badged', () => {
    expect(allServices.filter(serviceIdToBadge)).toEqual(['phone', 'email'])
  })

  test('avatar icon falls back to the tab icon when there is no special one', () => {
    // keybase has its own placeholder avatar
    expect(serviceIdToAvatarIcon('keybase')).not.toBe(serviceIdToIconFont('keybase'))
    expect(serviceIdToAvatarIcon('twitter')).toBe(serviceIdToIconFont('twitter'))
  })

  test('dark mode only overrides the services that need it', () => {
    // github's near-black would vanish on a dark background
    expect(serviceIdToAccentColor('github', false)).toBe('#333')
    expect(serviceIdToAccentColor('github', true)).toBe('#E7E8E8')
    expect(serviceIdToAccentColor('twitter', true)).toBe(serviceIdToAccentColor('twitter', false))
  })
})

describe('serviceMapToArray', () => {
  test('drops keybase and keeps the canonical tab order', () => {
    const map = {github: 'testuser', keybase: 'testuser', twitter: 'testuser'} as T.TB.ServiceMap
    expect(serviceMapToArray(map)).toEqual(['twitter', 'github'])
  })

  test('unknown services are ignored', () => {
    const map = {dns: 'example.com', reddit: 'testuser'} as unknown as T.TB.ServiceMap
    expect(serviceMapToArray(map)).toEqual(['reddit'])
  })

  test('an empty map yields nothing', () => {
    expect(serviceMapToArray({} as T.TB.ServiceMap)).toEqual([])
  })
})

describe('getSearchResults', () => {
  const alice = {id: 'alice'} as T.TB.User
  const results = new Map([
    ['test', new Map([['keybase', [alice]]])],
  ]) as unknown as T.Immutable<T.TB.SearchResults>

  test('finds results for a query', () => {
    expect(getSearchResults(results, 'test', 'keybase')).toEqual([alice])
  })

  test('the query is trimmed the same way the search stored it', () => {
    expect(getSearchResults(results, '  test  ', 'keybase')).toEqual([alice])
  })

  test('an unsearched query or service yields undefined rather than throwing', () => {
    expect(getSearchResults(results, 'nope', 'keybase')).toBeUndefined()
    expect(getSearchResults(results, 'test', 'twitter')).toBeUndefined()
  })
})
