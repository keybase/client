// @flow

import Render from './index.render'
import type {DumbComponentMap} from '../../../constants/types/more'
import HiddenString from '../../../util/hidden-string'

const baseMock = {
  paperkey: new HiddenString('elephant bag candy asteroid laptop mug second archive pizza ring fish bumpy down'),
  onFinish: () => console.log('success:onFinish'),
}

const dumbComponentMap: DumbComponentMap<Render> = {
  component: Render,
  mocks: {
    'Normal': baseMock,
  },
}

export default dumbComponentMap
