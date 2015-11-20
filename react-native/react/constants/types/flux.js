'use strict'
/* @flow */

export type Action = {
  type: string,
  error?: false,
  payload?: any
} | {
  type: string,
  error: true,
  payload: any
}

export type Dispatch = (action: Action) => void
