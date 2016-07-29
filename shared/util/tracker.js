/* @flow */

import type {SimpleProofState} from '../constants/tracker'
import {globalColors} from '../styles/style-guide'
import {warning, error} from '../constants/tracker'

type StateColors = {
  header: {
    background: string,
    text: string
  },
  username: string
}

export function stateColors ({currentlyFollowing, trackerState}: {currentlyFollowing: boolean, trackerState: SimpleProofState}): StateColors {
  if ([warning, error].indexOf(trackerState) !== -1) {
    return {
      header: {background: globalColors.red, text: globalColors.white},
      username: globalColors.red,
    }
  }
  if (currentlyFollowing) {
    return {
      header: {background: globalColors.green, text: globalColors.white},
      username: globalColors.green2,
    }
  } else {
    return {
      header: {background: globalColors.blue, text: globalColors.white},
      username: globalColors.orange,
    }
  }
}
