// @flow
// In order for the inbox rows to be calculated quickly we use fixed sizes for each type so
// in order for the list and the rows to ensure they're the same size we keep the sizes here
import {isMobile} from '../../../styles'

export const smallRowHeight = isMobile ? 64 : 56
export const bigRowHeight = isMobile ? 40 : 24
export const bigHeaderHeight = 32
export const dividerHeight = isMobile ? 56 : 40
