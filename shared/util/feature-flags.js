/* @flow */

import {trackerVersionTwo} from '../local-debug'

type FeatureFlag = {
  tracker: 'v1' | 'v2'
}
const ff: FeatureFlag = {
  tracker: trackerVersionTwo ? 'v2' : 'v1'
}
export default ff
