// @flow

export function formatTimeForConversationList(time: number, nowOverride?: ?number): string {
  return '[mocked]'
}

export function formatTimeForMessages(time: number, nowOverride?: number): string {
  return '[mocked]'
}

export const formatTimeForFS = (time: number): string => '[mocked]'

export function formatTimeForPopup(time: number): string {
  return '[mocked]'
}

export function formatTimeForStellarTransaction(timestamp: Date) {
  return {
    human: '[mocked]',
    tooltip: '[mocked]',
  }
}

export function formatTimeForStellarTransactionDetails(timestamp: Date) {
  return {
    human: '[mocked]',
    tooltip: '[mocked]',
  }
}

export function formatTimeForRevoked(time: number): string {
  return '[mocked]'
}

export function daysToLabel(days: number): string {
  return '[mocked]'
}

export function msToDHMS(ms: number): string {
  return '[mocked]'
}

export function formatDurationShort(ms: number): string {
  return '[mocked]'
}

export const formatDuration = (duration: number): string => '[mocked]'
export const formatDurationFromNowTo = (timeInFuture?: number): string => '[mocked]'
