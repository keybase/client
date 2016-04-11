import Checkbox from './checkbox'

export default {
  'Checkbox': {
    component: Checkbox,
    mocks: {
      'Normal - checked': {
        label: 'Normal - checked',
        checked: true
      },
      'Normal - unchecked': {
        label: 'Normal - unchecked',
        checked: false
      },
      'Disabled - checked': {
        label: 'Disabled - checked',
        disabled: true,
        checked: true
      },
      'Disabled - unchecked': {
        label: 'Disabled - unchecked',
        disabled: true,
        checked: false
      }
    }
  }
}
