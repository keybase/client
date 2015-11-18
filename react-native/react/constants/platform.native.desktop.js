'use strict'
/* @flow */

import { OS_DESKTOP } from './platform.shared'

export const isDev = process.env.NODE_ENV === 'development'
export const OS = OS_DESKTOP
export const isMobile = false
