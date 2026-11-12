import * as React from 'react'
import * as T from '@/constants/types'
import {waitingKeyTrackerProfileLoad} from '@/constants/strings'
import logger from '@/logger'
import {useRpcData} from '@/query'

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

export const useProofSuggestions = (enabled = true) => {
  // userChanged reloads it: see query/notifications
  const {data, error, reload} = useRpcData(T.RPCGen.userProofSuggestionsRpcPromise, undefined, {
    enabled,
    select: mapSuggestions,
    waitingKey: waitingKeyTrackerProfileLoad,
  })
  React.useEffect(() => {
    if (error) {
      logger.error(`Error loading proof suggestions: ${error.message}`)
    }
  }, [error])

  return {
    proofSuggestions: enabled ? (data ?? emptyProofSuggestions) : emptyProofSuggestions,
    reload,
  }
}
