// @flow
import PaperKey from '.'

import type {DumbComponentMap} from '../../../constants/types/more'

const baseMock = {
  onBack: () => console.log('onBack'),
  onSubmit: () => console.log('onBack'),
  onChangePaperKey: () => console.log('onBack'),
  paperKey: '',
  waitingForResponse: false,
  error: '',
}

const dumbComponentMap: DumbComponentMap<PaperKey> = {
  component: PaperKey,
  mocks: {
    Normal: baseMock,
  },
}

export default dumbComponentMap
