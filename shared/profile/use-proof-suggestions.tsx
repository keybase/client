import * as T from '@/constants/types'
import {waitingKeyTrackerProfileLoad} from '@/constants/strings'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import {useCurrentUserState} from '@/stores/current-user'
import type {RPCError} from '@/util/errors'
import {useRPCLoad} from '@/util/use-rpc-load'

const emptyProofSuggestions: ReadonlyArray<T.Tracker.Assertion> = []

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

const mapSuggestions = ({suggestions}: T.RPCGen.ProofSuggestionsRes) =>
  suggestions?.map(rpcSuggestionToAssertion) ?? emptyProofSuggestions

const logLoadError = (error: RPCError) => {
  logger.error(`Error loading proof suggestions: ${error.message}`)
}

export const useProofSuggestions = (enabled = true) => {
  const uid = useCurrentUserState(s => s.uid)
  const {data, refresh, reload} = useRPCLoad(
    T.RPCGen.userProofSuggestionsRpcPromise,
    [undefined, waitingKeyTrackerProfileLoad],
    // keyed on enabled so a disabled hook shows nothing and enabling it loads
    {enabled, key: enabled ? 'enabled' : 'disabled', map: mapSuggestions, onError: logLoadError}
  )

  useEngineActionListener('keybase.1.NotifyUsers.userChanged', action => {
    if (!enabled || action.payload.params.uid !== uid) {
      return
    }
    // a burst of these (one per replayed key change) loads once more after the load in flight
    refresh()
  })

  return {
    proofSuggestions: enabled ? (data ?? emptyProofSuggestions) : emptyProofSuggestions,
    reload,
  }
}
