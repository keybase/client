/* eslint-env jest */
import {SearchResult, SearchRecSection} from '../index'
import * as TeamBuilding from '../index'
import {userResultHeight} from '../user-result'
import {SectionDivider} from '../../common-adapters/index'

describe('team building list', () => {
  it('calculates list offsets properly', () => {
    const testSearchResult: SearchResult = {
      userId: '',
      username: '',
      prettyName: '',
      displayLabel: '',
      services: {},
      inTeam: false,
      isPreExistingTeamMember: false,
      followingState: 'NotFollowing',
    }
    const sections: Array<SearchRecSection> = [
      {
        label: 'test 1',
        shortcut: false,
        data: [testSearchResult, testSearchResult, testSearchResult],
      },
      {
        label: 'test 2',
        shortcut: false,
        data: [testSearchResult, testSearchResult],
      },
      {
        label: 'test 3',
        shortcut: false,
        data: [testSearchResult, testSearchResult, testSearchResult],
      },
    ]

    // our example list is as follows:
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

    const sectionLength = SectionDivider.height
    const rowLength = userResultHeight

    const _getRecLayout = (sections: Array<SearchRecSection>, indexInList: number) =>
      // @ts-ignore we don't care, this is just a test of pure function that doesn't even access props
      new TeamBuilding.default({})._getRecLayout(sections, indexInList)

    expect(_getRecLayout(sections, 0)).toEqual({index: 0, length: sectionLength, offset: 0})
    expect(_getRecLayout(sections, 1)).toEqual({index: 1, length: rowLength, offset: sectionLength})
    expect(_getRecLayout(sections, 2)).toEqual({
      index: 2,
      length: rowLength,
      offset: sectionLength + rowLength,
    })
    expect(_getRecLayout(sections, 3)).toEqual({
      index: 3,
      length: rowLength,
      offset: sectionLength + 2 * rowLength,
    })
    expect(_getRecLayout(sections, 4)).toEqual({
      index: 4,
      length: 0,
      offset: sectionLength + 3 * rowLength,
    })
    expect(_getRecLayout(sections, 5)).toEqual({
      index: 5,
      length: sectionLength,
      offset: sectionLength + 3 * rowLength,
    })
    expect(_getRecLayout(sections, 6)).toEqual({
      index: 6,
      length: rowLength,
      offset: 2 * sectionLength + 3 * rowLength,
    })
    expect(_getRecLayout(sections, 7)).toEqual({
      index: 7,
      length: rowLength,
      offset: 2 * sectionLength + 4 * rowLength,
    })
    expect(_getRecLayout(sections, 8)).toEqual({
      index: 8,
      length: 0,
      offset: 2 * sectionLength + 5 * rowLength,
    })
    expect(_getRecLayout(sections, 9)).toEqual({
      index: 9,
      length: sectionLength,
      offset: 2 * sectionLength + 5 * rowLength,
    })
    expect(_getRecLayout(sections, 10)).toEqual({
      index: 10,
      length: rowLength,
      offset: 3 * sectionLength + 5 * rowLength,
    })
    expect(_getRecLayout(sections, 11)).toEqual({
      index: 11,
      length: rowLength,
      offset: 3 * sectionLength + 6 * rowLength,
    })
    expect(_getRecLayout(sections, 12)).toEqual({
      index: 12,
      length: rowLength,
      offset: 3 * sectionLength + 7 * rowLength,
    })
    expect(_getRecLayout(sections, 13)).toEqual({
      index: 13,
      length: 0,
      offset: 3 * sectionLength + 8 * rowLength,
    })
  })
})
