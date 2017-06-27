/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import {configure} from '@storybook/react-native'
import loadBox from '../common-adapters/box.stories'
import loadAvatar from '../common-adapters/avatar.stories'

// Load common-adapter stories
const load = () => {
  configure(() => {
    loadBox()
    loadAvatar()
  }, module)
}

export default load
