/* eslint-env jest */
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Constants from '../../constants/chat2'
import * as ConstantsMessage from '../../constants/chat2/message'
import * as I from 'immutable'
import * as Types from '../../constants/types/chat2'
import HiddenString from '../../util/hidden-string'
import reducer from '../chat2'

jest.unmock('immutable')

describe('chat2 reducer', () => {
  const conversationIDKey = Types.stringToConversationIDKey('0')
  const author = 'chris'

  // 1: you wrote text
  // 2: you wrote text
  // 3: you attached
  // 4: someone else wrote text
  const initialState = Constants.makeState({
    messageMap: I.Map([
      [
        conversationIDKey,
        I.Map([
          [
            Types.numberToOrdinal(1),
            ConstantsMessage.makeMessageText({
              author,
              text: new HiddenString('one'),
            }),
          ],
          [
            Types.numberToOrdinal(2),
            ConstantsMessage.makeMessageText({
              author,
              text: new HiddenString('two'),
            }),
          ],
          [Types.numberToOrdinal(3), ConstantsMessage.makeMessageAttachment({author})],
          [
            Types.numberToOrdinal(4),
            ConstantsMessage.makeMessageText({
              author: 'someone_else',
              text: new HiddenString('four other'),
            }),
          ],
        ] as Array<[Types.Ordinal, ReturnType<typeof ConstantsMessage.makeMessageText>]>),
      ],
    ]),
    messageOrdinals: I.Map([
      [
        conversationIDKey,
        I.OrderedSet([
          Types.numberToOrdinal(1),
          Types.numberToOrdinal(2),
          Types.numberToOrdinal(3),
          Types.numberToOrdinal(4),
        ]),
      ],
    ]),
  })

  describe('messageSetEditing action', () => {
    it('edit last skips other people and non-text types', () => {
      const action = Chat2Gen.createMessageSetEditing({
        conversationIDKey,
        editLastUser: author,
        ordinal: null,
      })

      const newState = reducer(initialState, action)
      expect(newState.editingMap.get(conversationIDKey)).toEqual(Types.numberToOrdinal(2))
    })

    it('edit ignore attachments', () => {
      const action = Chat2Gen.createMessageSetEditing({
        conversationIDKey,
        ordinal: Types.numberToOrdinal(3),
      })

      const newState = reducer(initialState, action)
      expect(newState.editingMap.get(conversationIDKey)).toEqual(undefined)
    })

    it('edit specific ordinal and clear works', () => {
      const setAction = Chat2Gen.createMessageSetEditing({
        conversationIDKey,
        ordinal: Types.numberToOrdinal(1),
      })

      const state1 = reducer(initialState, setAction)
      expect(state1.editingMap.get(conversationIDKey)).toEqual(Types.numberToOrdinal(1))

      const clearAction = Chat2Gen.createMessageSetEditing({
        conversationIDKey,
        ordinal: null,
      })
      const state2 = reducer(state1, clearAction)
      expect(state2.editingMap.get(conversationIDKey)).toEqual(undefined)
    })
  })

  describe('messageSetQuoting action', () => {
    it('set quoted message works', () => {
      const setAction = Chat2Gen.createMessageSetQuoting({
        ordinal: Types.numberToOrdinal(1),
        sourceConversationIDKey: conversationIDKey,
        targetConversationIDKey: conversationIDKey,
      })

      const state1 = reducer(initialState, setAction)
      expect(state1.quote).toEqual(
        Constants.makeQuoteInfo({
          counter: 1,
          ordinal: Types.numberToOrdinal(1),
          sourceConversationIDKey: conversationIDKey,
          targetConversationIDKey: conversationIDKey,
        })
      )

      const state2 = reducer(state1, setAction)
      expect(state2.quote).toEqual(
        Constants.makeQuoteInfo({
          counter: 2,
          ordinal: Types.numberToOrdinal(1),
          sourceConversationIDKey: conversationIDKey,
          targetConversationIDKey: conversationIDKey,
        })
      )
    })
  })
})
