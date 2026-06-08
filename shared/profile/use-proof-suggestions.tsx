import * as React from 'react'
import * as T from '@/constants/types'
import {waitingKeyTrackerProfileLoad} from '@/constants/strings'
import {ignorePromise} from '@/constants/utils'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import {useCurrentUserState} from '@/stores/current-user'
import {RPCError} from '@/util/errors'

const emptyProofSuggestions: ReadonlyArray<T.Tracker.Assertion> = []

type ProofSuggestionsState = {
  enabled: boolean
  loadKey: number
  suggestions: ReadonlyArray<T.Tracker.Assertion>
}

const rpcRowColorToColor = (color: T.RPCGen.Identify3RowColor): T.Tracker.AssertionColor => {
  switch (color) {
    case T.RPCGen.Identify3RowColor.blue:
      return 'blue'
    case T.RPCGen.Identify3RowColor.red:
      return 'red'
    case T.RPCGen.Identify3RowColor.black:
      return 'black'
    case T.RPCGen.Identify3RowColor.green:
      return 'green'
    case T.RPCGen.Identify3RowColor.gray:
      return 'gray'
    case T.RPCGen.Identify3RowColor.yellow:
      return 'yellow'
    case T.RPCGen.Identify3RowColor.orange:
      return 'orange'
    default:
      logger.warn(`Unexpected proof suggestion color: ${color as any}`)
      return 'gray'
  }
}

const rpcSuggestionToAssertion = (suggestion: T.RPCGen.ProofSuggestion): T.Tracker.Assertion => {
  const assertionKey = suggestion.key === 'web' ? 'dnsOrGenericWebSite' : suggestion.key
  return {
    assertionKey,
    belowFold: suggestion.belowFold,
    color: 'gray',
    kid: '',
    metas: (suggestion.metas || []).map(meta => ({color: rpcRowColorToColor(meta.color), label: meta.label})),
    pickerSubtext: suggestion.pickerSubtext,
    pickerText: suggestion.pickerText,
    priority: -1,
    proofURL: '',
    sigID: '',
    siteIcon: suggestion.profileIcon || [],
    siteIconDarkmode: suggestion.profileIconDarkmode || [],
    siteIconFull: suggestion.pickerIcon || [],
    siteIconFullDarkmode: suggestion.pickerIconDarkmode || [],
    siteURL: '',
    state: 'suggestion',
    timestamp: 0,
    type: assertionKey,
    value: suggestion.profileText,
  }
}

export const useProofSuggestions = (enabled = true) => {
  const uid = useCurrentUserState(s => s.uid)
  const [proofSuggestionsState, setProofSuggestionsState] = React.useState<ProofSuggestionsState>({
    enabled,
    loadKey: 0,
    suggestions: emptyProofSuggestions,
  })
  const requestVersionRef = React.useRef(0)
  const loadKey =
    proofSuggestionsState.enabled === enabled
      ? proofSuggestionsState.loadKey
      : proofSuggestionsState.loadKey + 1
  const proofSuggestions =
    proofSuggestionsState.enabled === enabled ? proofSuggestionsState.suggestions : emptyProofSuggestions

  const reload = React.useCallback(() => {
    if (!enabled) {
      requestVersionRef.current += 1
      return
    }

    const version = requestVersionRef.current + 1
    requestVersionRef.current = version

    const load = async () => {
      try {
        const {suggestions} = await T.RPCGen.userProofSuggestionsRpcPromise(
          undefined,
          waitingKeyTrackerProfileLoad
        )
        if (requestVersionRef.current !== version) {
          return
        }
        const nextSuggestions = suggestions?.map(rpcSuggestionToAssertion) ?? emptyProofSuggestions
        setProofSuggestionsState(state =>
          state.enabled === enabled && state.loadKey === loadKey
            ? {...state, suggestions: nextSuggestions}
            : state
        )
      } catch (error) {
        if (!(error instanceof RPCError)) {
          return
        }
        if (requestVersionRef.current !== version) {
          return
        }
        logger.error(`Error loading proof suggestions: ${error.message}`)
      }
    }

    ignorePromise(load())
  }, [enabled, loadKey])

  React.useEffect(() => {
    reload()
  }, [reload])

  useEngineActionListener('keybase.1.NotifyUsers.userChanged', action => {
    if (!enabled || action.payload.params.uid !== uid) {
      return
    }
    reload()
  })

  if (proofSuggestionsState.enabled !== enabled) {
    setProofSuggestionsState(state =>
      state.enabled === enabled
        ? state
        : {enabled, loadKey: state.loadKey + 1, suggestions: emptyProofSuggestions}
    )
  }

  return {
    proofSuggestions,
    reload,
  }
}
