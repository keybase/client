// @flow
/* eslint-env jest */
// eslint-disable-next-line
import initStoryshots from '@storybook/addon-storyshots'
import 'jest'

jest.mock('moment', () => {
  const moment = jest.requireActual('moment-timezone')
  moment.tz.setDefault('UTC')
  return moment
})

initStoryshots()
