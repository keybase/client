// @flow

import {mapValues, forEach} from 'lodash'
import type {ChannelConfig, ChannelMap} from '../constants/types/saga'
import {buffers, channel} from 'redux-saga'
import {take} from 'redux-saga/effects'

export function createChannelMap<T> (channelConfig: ChannelConfig<T>): ChannelMap<T> {
  return mapValues(channelConfig, (v, k) => {
    return channel(v)
  })
}

export function putOnChannelMap<T> (channelMap: ChannelMap<T>, k: string, v: T): void {
  const c = channelMap[k]
  if (c) {
    c.put(v)
  } else {
    console.error('Trying to put, but no registered channel for', k)
  }
}

// TODO type this properly
export function takeFromChannelMap<T> (channelMap: ChannelMap<T>, k: string): any {
  const c = channelMap[k]
  if (c) {
    return take(c)
  } else {
    console.error('Trying to take, but no registered channel for', k)
  }
}

export function closeChannelMap<T> (channelMap: ChannelMap<T>): void {
  forEach(channelMap, c => c.close())
}

export function singleFixedChannelConfig<T> (ks: Array<string>): ChannelConfig<T> {
  return ks.reduce((acc, k) => {
    acc[k] = buffers.fixed(1)
    return acc
  }, {})
}
