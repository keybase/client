/* eslint-env jest */
// eslint-disable-next-line
import path from 'path'
import initStoryshots from '@storybook/addon-storyshots'

jest.mock('../../util/timestamp')

initStoryshots({
  // eslint-disable-next-line
  configPath: path.resolve(__dirname, '../../.storybook-rn/config.js'),
  framework: 'react-native',
})
