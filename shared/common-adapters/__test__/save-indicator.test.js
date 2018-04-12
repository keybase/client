// @flow
/* eslint-env jest */
import {type Props, type State, computeNextState} from '../save-indicator'

describe('computeNextState', () => {
  it('steady to saving', () => {
    const props: Props = {saving: true, minSavingTimeMs: 2000, savedTimeoutMs: 3000}
    const state: State = {
      saving: true,
      lastSave: new Date(0),
      saveState: 'steady',
      lastJustSaved: new Date(0),
    }
    const now = new Date(10000)
    const nextState = computeNextState(props, state, now)
    expect(nextState).toEqual('saving')
  })
})
