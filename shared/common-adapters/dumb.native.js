// @flow
import Checkbox from './checkbox'

import type {DumbComponentMap} from '../constants/types/more'

const onCheck = () => console.log('checkbox:onCheck')

const checkboxMap: DumbComponentMap<Checkbox> = {
  component: Checkbox,
  mocks: {
    'Normal - checked': {
      label: 'Normal - checked',
      checked: true,
      onCheck
    },
    'Normal - unchecked': {
      label: 'Normal - unchecked',
      checked: false,
      onCheck
    },
    'Disabled - checked': {
      label: 'Disabled - checked',
      disabled: true,
      checked: true,
      onCheck
    },
    'Disabled - unchecked': {
      label: 'Disabled - unchecked',
      disabled: true,
      checked: false,
      onCheck
    }
  }
}

export default {
  'Checkbox': checkboxMap
}
