// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import RolePicker from './index'

let rolePickerProps = toMerge => ({
  disabledRoles: {},
  onSelectRole: role => {
    Sb.action('onSelectRole - not attached to state')(role)
  },
  ...toMerge,
})

class StateWrapper extends React.Component<any, any> {
  state = {}
  constructor() {
    super()
    this.state = {
      onSelectRole: role => {
        Sb.action('onSelectRole')(role)
        this.setState({selectedRole: role})
      },
    }
  }

  render() {
    return this.props.storyFn()(this.state)
  }
}

const load = () => {
  Sb.storiesOf('Teams/Role Picker', module)
    .addDecorator(storyFn => <StateWrapper storyFn={storyFn} />)
    .add('Picker', () => state => <RolePicker {...rolePickerProps(state)} />)
    .add('Picker - Disabled Owners', () => state => (
      <RolePicker
        {...rolePickerProps({
          disabledRoles: {
            Owners: 'Non-Keybase users can not be added as owners.',
          },
          onLetIn: Sb.action('Let in'),
          ...state,
        })}
      />
    ))
    .add('Picker - Header text', () => state => (
      <RolePicker
        {...rolePickerProps({
          headerText: 'Add them as:',
          onCancel: Sb.action('cancel'),
          ...state,
        })}
      />
    ))
    .add('Picker - With Let In / Cancel', () => state => (
      <RolePicker
        {...rolePickerProps({
          headerText: 'Add them as:',
          onCancel: Sb.action('cancel'),
          onLetIn: Sb.action('Let in'),
          ...state,
        })}
      />
    ))
}

export default load
