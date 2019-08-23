/* eslint-env jest */
import TeamBuilding, {SearchResult, SearchRecSection} from '../index'
import {sortAndSplitRecommendations} from '../container'
import {userResultHeight} from '../user-result'
import {SectionDivider} from '../../common-adapters/index'

describe('team building list', () => {
  it('calculates list offsets properly', () => {
    const testSearchResult: SearchResult = {
      displayLabel: '',
      followingState: 'NotFollowing',
      inTeam: false,
      isPreExistingTeamMember: false,
      prettyName: '',
      services: {},
      userId: '',
      username: '',
    }
    const sections: Array<SearchRecSection> = [
      {
        data: [testSearchResult, testSearchResult, testSearchResult],
        label: 'test 1',
        shortcut: false,
      },
      {
        data: [testSearchResult, testSearchResult],
        label: 'test 2',
        shortcut: false,
      },
      {
        data: [testSearchResult, testSearchResult, testSearchResult],
        label: 'test 3',
        shortcut: false,
      },
    ]

    // Our example list is as follows:
    // Team building list does not render section footers, but they still occupy
    // an index that getItemLayout has to be aware of.
    //
    //  0  [ test 1 ]
    //  1  row 0
    //  2  row 1
    //  3  row 2
    //  4  (footer)
    //  5  [ test 2 ]
    //  6  row 0
    //  7  row 1
    //  8  (footer)
    //  9  [ test 3 ]
    // 10  row 0
    // 11  row 1
    // 12  row 2
    // 13  (footer)

    const sectionDividerHeight = SectionDivider.height
    const dataRowHeight = userResultHeight

    const _getRecLayout = (sections: Array<SearchRecSection>, indexInList: number) =>
      // @ts-ignore we don't care about invalid props, this is for testing pure method that doesn't rely on props
      new TeamBuilding({})._getRecLayout(sections, indexInList)

    // Index 0 is first header - offset 0, length = sectionDividerHeight
    expect(_getRecLayout(sections, 0)).toEqual({index: 0, length: sectionDividerHeight, offset: 0})
    expect(_getRecLayout(sections, 1)).toEqual({
      index: 1,
      length: dataRowHeight,
      offset: sectionDividerHeight,
    })
    expect(_getRecLayout(sections, 2)).toEqual({
      index: 2,
      length: dataRowHeight,
      offset: sectionDividerHeight + dataRowHeight,
    })
    expect(_getRecLayout(sections, 3)).toEqual({
      index: 3,
      length: dataRowHeight,
      offset: sectionDividerHeight + 2 * dataRowHeight,
    })
    // Index 4 is a footer - length = 0.
    expect(_getRecLayout(sections, 4)).toEqual({
      index: 4,
      length: 0,
      offset: sectionDividerHeight + 3 * dataRowHeight,
    })
    // Index 5 is next section header - offset is the same as above, because of 0-length footer.
    expect(_getRecLayout(sections, 5)).toEqual({
      index: 5,
      length: sectionDividerHeight,
      offset: sectionDividerHeight + 3 * dataRowHeight,
    })
    expect(_getRecLayout(sections, 6)).toEqual({
      index: 6,
      length: dataRowHeight,
      offset: 2 * sectionDividerHeight + 3 * dataRowHeight,
    })
    expect(_getRecLayout(sections, 7)).toEqual({
      index: 7,
      length: dataRowHeight,
      offset: 2 * sectionDividerHeight + 4 * dataRowHeight,
    })
    expect(_getRecLayout(sections, 8)).toEqual({
      index: 8,
      length: 0,
      offset: 2 * sectionDividerHeight + 5 * dataRowHeight,
    })
    expect(_getRecLayout(sections, 9)).toEqual({
      index: 9,
      length: sectionDividerHeight,
      offset: 2 * sectionDividerHeight + 5 * dataRowHeight,
    })
    expect(_getRecLayout(sections, 10)).toEqual({
      index: 10,
      length: dataRowHeight,
      offset: 3 * sectionDividerHeight + 5 * dataRowHeight,
    })
    expect(_getRecLayout(sections, 11)).toEqual({
      index: 11,
      length: dataRowHeight,
      offset: 3 * sectionDividerHeight + 6 * dataRowHeight,
    })
    expect(_getRecLayout(sections, 12)).toEqual({
      index: 12,
      length: dataRowHeight,
      offset: 3 * sectionDividerHeight + 7 * dataRowHeight,
    })
    // There is a 0-length footer after last section as well.
    expect(_getRecLayout(sections, 13)).toEqual({
      index: 13,
      length: 0,
      offset: 3 * sectionDividerHeight + 8 * dataRowHeight,
    })
  })
  it('sorts recommendations by romanized first ascii character', () => {
    const testSearchResult = {
      contact: true,
      displayLabel: '',
      followingState: 'NotFollowing' as const,
      inTeam: false,
      isPreExistingTeamMember: false,
      key: '',
      prettyName: '',
      services: {},
      userId: '',
      username: '',
    }
    const makeTests = (arr: Array<[string, string]>) =>
      arr.map(([name, expect]) => ({
        expect,
        result: {...testSearchResult, prettyName: name},
      }))
    const tests = makeTests([
      ['James', 'J'],
      ['Łukasz', 'L'],
      ['高嵩', 'G'],
      ['Über Foo', 'U'],
      ['Этери', 'E'],
      ['हिन्दी', 'H'],
      ['தமிழ்', 'T'],
      ['తెలుగు', 'T'],
    ])
    const sections = sortAndSplitRecommendations(tests.map(t => t.result), false) || []
    const sectionMap = {}
    for (const s of sections) {
      sectionMap[s.label] = s.data
    }
    for (const t of tests) {
      expect(sectionMap[t.expect]).toContainEqual(t.result)
    }
  })
})
