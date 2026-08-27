/// <reference types="jest" />
import type * as T from '@/constants/types'
import type * as Types from './types'
import {numSectionLabel} from './recs-and-recos'
import {
  createSection,
  deriveSearchResults,
  getRecommendationsSectionIndex,
  isAlpha,
  letterToAlphaIndex,
  sortAndSplitRecommendations,
} from './list-body'

type Rec = NonNullable<ReturnType<typeof deriveSearchResults>>[number]

const makeRec = (p: Partial<Rec>): Rec => ({
  contact: false,
  displayLabel: '',
  followingState: 'NoState',
  inTeam: false,
  isPreExistingTeamMember: false,
  isYou: false,
  key: '',
  pictureUrl: undefined,
  prettyName: '',
  services: {},
  userId: '',
  username: '',
  ...p,
})

const makeUser = (p: Partial<T.TB.User>): T.TB.User => ({
  id: 'testuser',
  prettyName: 'Test User',
  serviceId: 'keybase',
  serviceMap: {},
  username: 'testuser',
  ...p,
})

const emptyMembers = new Map<string, T.Teams.MemberInfo>()
const noUsers = new Set<T.TB.User>()
const noFollowing = new Set<string>()

const labelsOf = (sections: ReadonlyArray<Types.SearchRecSection> | undefined) =>
  sections?.map(s => s.label)

const namesOf = (section: Types.SearchRecSection | undefined) =>
  section?.data.map(d => ('prettyName' in d ? d.prettyName : '<button>'))

describe('deriveSearchResults', () => {
  test('undefined users stays undefined so the caller can show a spinner', () => {
    expect(deriveSearchResults(undefined, noUsers, 'testuser', noFollowing, emptyMembers)).toBeUndefined()
  })

  test('an empty list maps to an empty list, not undefined', () => {
    expect(deriveSearchResults([], noUsers, 'testuser', noFollowing, emptyMembers)).toEqual([])
  })

  test('maps a keybase user onto the row shape', () => {
    const user = makeUser({
      id: 'testuser-mac',
      label: 'a label',
      pictureUrl: 'http://example.com/a.png',
      prettyName: 'Test Mac',
      serviceMap: {keybase: 'testuser-mac'},
      username: 'testuser-mac',
    })
    const [row] = deriveSearchResults([user], noUsers, 'testuser', noFollowing, emptyMembers) ?? []
    expect(row).toEqual({
      contact: false,
      displayLabel: 'a label',
      followingState: 'NotFollowing',
      inTeam: false,
      isPreExistingTeamMember: false,
      isYou: false,
      key: 'testuser-mac&Test Mac&a label&false',
      pictureUrl: 'http://example.com/a.png',
      prettyName: 'Test Mac',
      services: {keybase: 'testuser-mac'},
      userId: 'testuser-mac',
      username: 'testuser-mac',
    })
  })

  test('a missing label becomes an empty displayLabel', () => {
    const [row] = deriveSearchResults([makeUser({})], noUsers, 'testuser', noFollowing, emptyMembers) ?? []
    expect(row?.displayLabel).toBe('')
  })

  test('following state comes from the keybase assertion', () => {
    const users = [
      makeUser({id: 'you', serviceMap: {keybase: 'testuser'}}),
      makeUser({id: 'followed', serviceMap: {keybase: 'testuser-mac'}}),
      makeUser({id: 'stranger', serviceMap: {keybase: 'someone'}}),
    ]
    const rows = deriveSearchResults(users, noUsers, 'testuser', new Set(['testuser-mac']), emptyMembers)
    expect(rows?.map(r => r.followingState)).toEqual(['You', 'Following', 'NotFollowing'])
  })

  test('a result with no keybase proof has no following state at all', () => {
    const rows = deriveSearchResults(
      [makeUser({id: 'testuser@twitter', serviceMap: {twitter: 'testuser'}})],
      noUsers,
      'testuser',
      noFollowing,
      emptyMembers
    )
    expect(rows?.[0]?.followingState).toBe('NoState')
  })

  test('inTeam is keyed off the ids already selected', () => {
    const picked = makeUser({id: 'testuser-mac'})
    const rows = deriveSearchResults(
      [makeUser({id: 'testuser-mac'}), makeUser({id: 'testuser'})],
      new Set([picked]),
      'nobody',
      noFollowing,
      emptyMembers
    )
    expect(rows?.map(r => r.inTeam)).toEqual([true, false])
  })

  test('pre-existing team members are flagged from the member map', () => {
    const members = new Map([['testuser-mac', {} as T.Teams.MemberInfo]])
    const rows = deriveSearchResults(
      [makeUser({id: 'testuser-mac'}), makeUser({id: 'testuser'})],
      noUsers,
      'nobody',
      noFollowing,
      members
    )
    expect(rows?.map(r => r.isPreExistingTeamMember)).toEqual([true, false])
  })

  test('isYou compares the username, not the assertion id', () => {
    const rows = deriveSearchResults(
      [makeUser({id: 'testuser@twitter', username: 'testuser'})],
      noUsers,
      'testuser',
      noFollowing,
      emptyMembers
    )
    expect(rows?.[0]?.isYou).toBe(true)
    expect(rows?.[0]?.userId).toBe('testuser@twitter')
  })

  test('phone numbers in the name and label are prettified', () => {
    const rows = deriveSearchResults(
      [makeUser({contact: true, id: '+18005550123@phone', label: '+18005550123', prettyName: 'Test User'})],
      noUsers,
      'nobody',
      noFollowing,
      emptyMembers
    )
    expect(rows?.[0]?.displayLabel).toBe('+1 (800) 555-0123')
    expect(rows?.[0]?.prettyName).toBe('Test User')
    expect(rows?.[0]?.contact).toBe(true)
  })

  test('the row key separates identical ids by name, label and contactness', () => {
    const rows = deriveSearchResults(
      [
        makeUser({id: 'testuser', label: 'one', prettyName: 'Test'}),
        makeUser({contact: true, id: 'testuser', label: 'one', prettyName: 'Test'}),
        makeUser({id: 'testuser', label: 'two', prettyName: 'Test'}),
      ],
      noUsers,
      'nobody',
      noFollowing,
      emptyMembers
    )
    const keys = rows?.map(r => r.key) ?? []
    expect(new Set(keys).size).toBe(3)
    expect(keys[0]).toBe('testuser&Test&one&false')
    expect(keys[1]).toBe('testuser&Test&one&true')
  })
})

describe('alphabet helpers', () => {
  test('isAlpha only accepts lowercase latin letters', () => {
    expect(isAlpha('a')).toBe(true)
    expect(isAlpha('z')).toBe(true)
    expect(isAlpha('A')).toBe(false)
    expect(isAlpha('4')).toBe(false)
    expect(isAlpha('+')).toBe(false)
    expect(isAlpha('é')).toBe(false)
    expect(isAlpha('')).toBe(false)
  })

  test('letterToAlphaIndex is 0 based from a', () => {
    expect(letterToAlphaIndex('a')).toBe(0)
    expect(letterToAlphaIndex('m')).toBe(12)
    expect(letterToAlphaIndex('z')).toBe(25)
  })

  test('createSection defaults to an empty, unshared data array', () => {
    const one = createSection('A', true)
    const two = createSection('B', false)
    expect(one).toEqual({data: [], label: 'A', shortcut: true})
    one.data.push({isSearchHint: true})
    expect(two.data).toEqual([])
  })

  test('createSection keeps the data it was handed', () => {
    const data: Array<Types.ResultData> = [{isImportButton: true}]
    expect(createSection('', false, data).data).toBe(data)
  })
})

describe('getRecommendationsSectionIndex', () => {
  test('non-contacts always land in the recommendations section', () => {
    expect(getRecommendationsSectionIndex(makeRec({prettyName: 'Zed'}), 1, 28)).toBe(1)
    expect(getRecommendationsSectionIndex(makeRec({prettyName: '42'}), 0, 27)).toBe(0)
  })

  test('contacts bucket by the first letter of the pretty name', () => {
    const rec = makeRec({contact: true, prettyName: 'Alice'})
    expect(getRecommendationsSectionIndex(rec, 1, 28)).toBe(2)
    expect(getRecommendationsSectionIndex(makeRec({contact: true, prettyName: 'Zoe'}), 1, 28)).toBe(27)
  })

  test('bucketing is case insensitive', () => {
    const upper = getRecommendationsSectionIndex(makeRec({contact: true, prettyName: 'Bob'}), 1, 28)
    const lower = getRecommendationsSectionIndex(makeRec({contact: true, prettyName: 'bob'}), 1, 28)
    expect(upper).toBe(lower)
    expect(upper).toBe(3)
  })

  test('the display label is the fallback when there is no pretty name', () => {
    expect(getRecommendationsSectionIndex(makeRec({contact: true, displayLabel: 'Carl'}), 1, 28)).toBe(4)
  })

  test('non-alpha leading characters go to the numeric section', () => {
    expect(getRecommendationsSectionIndex(makeRec({contact: true, prettyName: '+1800'}), 1, 28)).toBe(28)
    expect(getRecommendationsSectionIndex(makeRec({contact: true, prettyName: '9lives'}), 1, 28)).toBe(28)
    expect(getRecommendationsSectionIndex(makeRec({contact: true, prettyName: 'émile'}), 1, 28)).toBe(28)
  })

  test('a nameless contact has no section at all', () => {
    expect(getRecommendationsSectionIndex(makeRec({contact: true}), 1, 28)).toBeUndefined()
  })

  test('the recommendation index shifts every alpha bucket', () => {
    expect(getRecommendationsSectionIndex(makeRec({contact: true, prettyName: 'Alice'}), 0, 27)).toBe(1)
    expect(getRecommendationsSectionIndex(makeRec({contact: true, prettyName: 'Alice'}), 1, 28)).toBe(2)
  })
})

describe('sortAndSplitRecommendations', () => {
  const suggestion = (prettyName: string) => makeRec({prettyName, userId: prettyName})
  const contact = (prettyName: string) => makeRec({contact: true, prettyName, userId: prettyName})

  test('undefined results stay undefined', () => {
    expect(sortAndSplitRecommendations(undefined, false)).toBeUndefined()
  })

  test('no results at all still yields the search hint', () => {
    expect(sortAndSplitRecommendations([], false)).toEqual([{data: [{isSearchHint: true}], label: '', shortcut: false}])
  })

  test('the import-contacts button is the very first section', () => {
    const sections = sortAndSplitRecommendations([contact('Alice')], true)
    expect(sections?.[0]).toEqual({data: [{isImportButton: true}], label: '', shortcut: false})
    expect(labelsOf(sections)).toEqual(['', 'A', ''])
  })

  test('without the button there is no leading empty section', () => {
    expect(labelsOf(sortAndSplitRecommendations([contact('Alice')], false))).toEqual(['A', ''])
  })

  test('keybase suggestions all collapse into one Recommendations section, in order', () => {
    const sections = sortAndSplitRecommendations(
      [suggestion('Zoe'), suggestion('Alice'), suggestion('Mike')],
      false
    )
    expect(labelsOf(sections)).toEqual(['Recommendations', ''])
    expect(namesOf(sections?.[0])).toEqual(['Zoe', 'Alice', 'Mike'])
    expect(sections?.[0]?.shortcut).toBe(false)
  })

  test('contacts are split into alphabetical sections regardless of input order', () => {
    const sections = sortAndSplitRecommendations(
      [contact('Zoe'), contact('Bob'), contact('Alice'), contact('bill')],
      false
    )
    expect(labelsOf(sections)).toEqual(['A', 'B', 'Z', ''])
    expect(namesOf(sections?.[1])).toEqual(['Bob', 'bill'])
    expect(sections?.slice(0, 3).every(s => s.shortcut)).toBe(true)
  })

  test('suggestions come before every contact section even when they are last in the input', () => {
    const sections = sortAndSplitRecommendations(
      [contact('Alice'), suggestion('Zoe'), contact('Bob')],
      false
    )
    expect(labelsOf(sections)).toEqual(['Recommendations', 'A', 'B', ''])
    expect(namesOf(sections?.[0])).toEqual(['Zoe'])
  })

  test('numeric and unsortable contacts land in a trailing 0-9 section', () => {
    const sections = sortAndSplitRecommendations(
      [contact('+1 (800) 555-0123'), contact('Alice'), contact('9 lives')],
      false
    )
    expect(labelsOf(sections)).toEqual(['A', numSectionLabel, ''])
    expect(namesOf(sections?.[1])).toEqual(['+1 (800) 555-0123', '9 lives'])
  })

  test('nameless contacts are dropped instead of creating a section', () => {
    const sections = sortAndSplitRecommendations([contact('Alice'), makeRec({contact: true})], false)
    expect(labelsOf(sections)).toEqual(['A', ''])
    expect(sections?.[0]?.data).toHaveLength(1)
  })

  test('empty sections between used letters are removed', () => {
    const sections = sortAndSplitRecommendations([contact('Alice'), contact('Zoe')], false)
    expect(labelsOf(sections)).toEqual(['A', 'Z', ''])
  })

  test('the search hint only shows for short result lists', () => {
    const four = ['a', 'b', 'c', 'd'].map(suggestion)
    expect(labelsOf(sortAndSplitRecommendations(four, false))).toEqual(['Recommendations', ''])
    expect(sortAndSplitRecommendations(four, false)?.at(-1)?.data).toEqual([{isSearchHint: true}])

    const five = [...four, suggestion('e')]
    expect(labelsOf(sortAndSplitRecommendations(five, false))).toEqual(['Recommendations'])
  })

  test('dropped nameless contacts still count toward the search-hint threshold', () => {
    const results = [...Array(5)].map(() => makeRec({contact: true}))
    expect(sortAndSplitRecommendations(results, false)).toEqual([])
  })

  test('a single suggestion produces one section plus the hint', () => {
    const sections = sortAndSplitRecommendations([suggestion('Alice')], false)
    expect(sections).toHaveLength(2)
    expect(namesOf(sections?.[0])).toEqual(['Alice'])
    expect(sections?.[1]?.data).toEqual([{isSearchHint: true}])
  })

  test('a full interleaved set keeps button, suggestions, letters, numbers, hint in order', () => {
    const sections = sortAndSplitRecommendations(
      [
        contact('Mike'),
        suggestion('testuser'),
        contact('123'),
        suggestion('testuser-mac'),
        contact('Alice'),
        contact('mary'),
      ],
      true
    )
    expect(labelsOf(sections)).toEqual(['', 'Recommendations', 'A', 'M', numSectionLabel])
    expect(namesOf(sections?.[1])).toEqual(['testuser', 'testuser-mac'])
    expect(namesOf(sections?.[3])).toEqual(['Mike', 'mary'])
    expect(namesOf(sections?.[4])).toEqual(['123'])
  })
})
