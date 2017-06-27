/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import {configure} from '@storybook/react-native'
import loadBox from '../common-adapters/box.stories'

// Load common-adapter stories
const load = () => {
  configure(() => {
    loadBox()
  }, module)
}

export default load
