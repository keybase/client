import * as React from 'react'
import * as Styles from '@/styles'
import Box from './box'
import Icon from './icon'
import ProgressIndicator from './progress-indicator'
import Text from './text'

const Kb = {
  Box,
  Icon,
  ProgressIndicator,
  Text,
}

// States of the state machine for the save indicator:
//
//   steady:           (initial state) Nothing's been saved yet, or enough time
//                     has passed since the last save. Display nothing.
//   saving:           In the middle of saving; display a progress indicator.
//   savingHysteresis: Just finished saving, but still display a
//                     progress indicator until some minimum time has
//                     elapsed.
//   justSaved:        Just finished saving; display a checkbox and 'Saved' for some minimum time.
//
// The possible transitions are (implemented in computeNextState):
//
//   * -> saving:                   whenever Props.saving goes from true to false.
//   saving -> savingHysteresis:    whenever Props.saving goes from false to true.
//   savingHysteresis -> justSaved: whenever at least minSavingTimeMs
//                                  has elapsed in the
//                                  saving/savingHysteresis state.
//   justSaved -> steady:           whenever at least savedTimeoutMs has elapsed
//                                  in the justSaved state.
type SaveState = 'steady' | 'saving' | 'savingHysteresis' | 'justSaved'

export type Props = {
  saving: boolean
  style?: Styles.StylesCrossPlatform
  // Minimum duration to stay in saving or savingHysteresis.
  minSavingTimeMs: number
  // Minimum duration to stay in justSaved.
  savedTimeoutMs: number
  debugLog?: (arg0: string) => void
}

// computeNextState takes props and state, possibly with updated
// saving / lastSave fields, the current time, and returns either:
//
// - null:      Remain in the current state.
// - SaveState: Transition to the returned state.
// - number:    Wait the returned number of ms, then run computeNextState again.
const computeNextState = (
  props: {minSavingTimeMs: number; savedTimeoutMs: number},
  state: {saving: boolean; lastSave: Date; saveState: SaveState; lastJustSaved: Date},
  now: Date
): null | SaveState | number => {
  const {saveState} = state
  const {minSavingTimeMs, savedTimeoutMs} = props
  switch (saveState) {
    case 'steady':
      if (state.saving) {
        return 'saving'
      }
      return null
    case 'saving':
      if (state.saving) {
        return null
      }
      return 'savingHysteresis'
    case 'savingHysteresis': {
      if (state.saving) {
        return 'saving'
      }
      const timeToJustSaved = state.lastSave.getTime() + minSavingTimeMs - now.getTime()
      if (timeToJustSaved > 0) {
        return timeToJustSaved
      }
      return 'justSaved'
    }
    case 'justSaved': {
      if (state.saving) {
        return 'saving'
      }
      const timeToSteady = state.lastJustSaved.getTime() + savedTimeoutMs - now.getTime()
      if (timeToSteady > 0) {
        return timeToSteady
      }
      return 'steady'
    }
  }
}

const defaultStyle = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  height: Styles.globalMargins.medium,
  justifyContent: 'center',
} as const

const SaveIndicator = (props: Props) => {
  const {minSavingTimeMs, savedTimeoutMs, debugLog, saving, style} = props
  const [state, setState] = React.useState({
    lastJustSaved: new Date(0),
    lastSave: new Date(0),
    saveState: 'steady' as SaveState,
    saving: false,
  })

  const timeoutIDRef = React.useRef<ReturnType<typeof setTimeout>>()

  const _clearTimeout = () => {
    if (timeoutIDRef.current) {
      clearTimeout(timeoutIDRef.current)
      timeoutIDRef.current = undefined
    }
  }

  const runStateMachine = React.useCallback(() => {
    _clearTimeout()

    const now = new Date()
    const result = computeNextState({minSavingTimeMs, savedTimeoutMs}, state, now)
    if (!result) {
      return
    }

    if (typeof result === 'number') {
      timeoutIDRef.current = setTimeout(runStateMachine, result)
      return
    }

    const newPartialState = {
      lastJustSaved: result === 'justSaved' ? now : state.lastJustSaved,
      saveState: result,
    } as const
    if (debugLog) {
      debugLog(`runStateMachine: merging ${JSON.stringify(newPartialState)} into ${JSON.stringify(state)}`)
    }
    setState(prevState => ({...prevState, ...newPartialState}))
  }, [debugLog, minSavingTimeMs, savedTimeoutMs, state])

  React.useEffect(() => {
    if (saving !== state.saving) {
      const newPartialState = {
        lastSave: saving ? new Date() : state.lastSave,
        saving: saving,
      }
      if (debugLog) {
        debugLog(
          `componentDidUpdate: merging ${JSON.stringify(newPartialState)} into ${JSON.stringify(state)}`
        )
      }
      setState(prevState => ({...prevState, ...newPartialState}))
    }

    runStateMachine()
  }, [debugLog, saving, runStateMachine, state])

  React.useEffect(() => {
    return () => {
      _clearTimeout()
    }
  }, [])

  const getChildren = () => {
    const {saveState} = state
    switch (saveState) {
      case 'steady':
        return null
      case 'saving':
      case 'savingHysteresis':
        return <Kb.ProgressIndicator style={{width: Styles.globalMargins.medium}} />
      case 'justSaved':
        return (
          <>
            <Kb.Icon type="iconfont-check" color={Styles.globalColors.green} />
            <Kb.Text type="BodySmall" style={{color: Styles.globalColors.greenDark}}>
              &nbsp; Saved
            </Kb.Text>
          </>
        )
    }
  }

  return <Kb.Box style={Styles.collapseStyles([defaultStyle, style])}>{getChildren()}</Kb.Box>
}

export default SaveIndicator
