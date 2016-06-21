// @flow

import Render from './index.render'
import type {DumbComponentMap} from '../../../constants/types/more'

const baseMock = {
  onBack: () => console.log('onBack'),
  onSubmit: () => console.log('onBack'),
  onChangePaperKey: () => console.log('onBack'),
  paperKey: '',
  waitingForResponse: false,
}

const dumbComponentMap: DumbComponentMap<Render> = {
  component: Render,
  mocks: {
    'Normal': baseMock,
  },
}

export default dumbComponentMap
