/* eslint-env jest */
import {_Props, State, computeNextState} from '../save-indicator'

describe('computeNextState', () => {
  it('steady to saving', () => {
    const props: _Props = {minSavingTimeMs: 2000, savedTimeoutMs: 3000, saving: false}
    const state: State = {
      lastJustSaved: new Date(0),
      lastSave: new Date(0),
      saveState: 'steady',
      saving: false,
    }
    const now = new Date(10000)

    {
      const nextState = computeNextState(props, state, now)
      expect(nextState).toEqual(null)
    }

    {
      const nextState = computeNextState(
        {...props, saving: true},
        {...state, lastSave: new Date(5000), saving: true},
        now
      )
      expect(nextState).toEqual('saving')
    }
  })

  it('saving to savingHysteresis', () => {
    const props: _Props = {minSavingTimeMs: 2000, savedTimeoutMs: 3000, saving: true}
    const state: State = {
      lastJustSaved: new Date(0),
      lastSave: new Date(5000),
      saveState: 'saving',
      saving: true,
    }
    const now = new Date(10000)

    {
      const nextState = computeNextState(props, state, now)
      expect(nextState).toEqual(null)
    }

    {
      const nextState = computeNextState({...props, saving: false}, {...state, saving: false}, now)
      expect(nextState).toEqual('savingHysteresis')
    }
  })

  it('savingHysteresis to saving or justSaved', () => {
    const props: _Props = {minSavingTimeMs: 2000, savedTimeoutMs: 3000, saving: false}
    const state: State = {
      lastJustSaved: new Date(0),
      lastSave: new Date(5000),
      saveState: 'savingHysteresis',
      saving: false,
    }
    const now = new Date(6999)

    {
      const nextState = computeNextState(props, state, now)
      expect(nextState).toEqual(1)
    }

    {
      const nextState = computeNextState({...props, saving: true}, {...state, saving: true}, now)
      expect(nextState).toEqual('saving')
    }

    {
      const nextState = computeNextState(props, state, new Date(7000))
      expect(nextState).toEqual('justSaved')
    }
  })

  it('justSaved to saving or steady', () => {
    const props: _Props = {minSavingTimeMs: 2000, savedTimeoutMs: 3000, saving: false}
    const state: State = {
      lastJustSaved: new Date(6000),
      lastSave: new Date(5000),
      saveState: 'justSaved',
      saving: false,
    }
    const now = new Date(8999)

    {
      const nextState = computeNextState(props, state, now)
      expect(nextState).toEqual(1)
    }

    {
      const nextState = computeNextState({...props, saving: true}, {...state, saving: true}, now)
      expect(nextState).toEqual('saving')
    }

    {
      const nextState = computeNextState(props, state, new Date(9000))
      expect(nextState).toEqual('steady')
    }
  })
})
