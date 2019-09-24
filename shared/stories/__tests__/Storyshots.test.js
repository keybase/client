/* eslint-env jest */
// eslint-disable-next-line
import initStoryshots from '@storybook/addon-storyshots'

jest.mock('../../util/timestamp')
jest.mock('../../common-adapters/floating-box/index.desktop')

initStoryshots({
  configPath: '.storybook',
})
