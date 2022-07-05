import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'
import RoleButton from './index'
import {FloatingRolePicker} from '../role-picker'

let roleButtonProps = toMerge => ({
  onClick: Sb.action('click'),
  selectedRole: 'writer',
  ...toMerge,
})

class StateWrapper extends React.Component<any, any> {
  state = {}
  constructor(props) {
    super(props)
    this.state = {
      onSelectRole: role => {
        Sb.action('onSelectRole')(role)
        this.setState({selectedRole: role})
      },
    }
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" alignItems="center" style={{height: 600, justifyContent: 'flex-start'}}>
        {this.props.storyFn()(this.state, s => this.setState(s))}
      </Kb.Box2>
    )
  }
}

const load = () => {
  Sb.storiesOf('Teams/Role Button', module)
    .addDecorator(storyFn => <StateWrapper storyFn={storyFn} />)
    .add('Button - Owner', () => state => (
      <RoleButton
        {...roleButtonProps({
          selectedRole: 'owner',
          ...state,
        })}
      />
    ))
    .add('Button - Admin', () => state => (
      <RoleButton
        {...roleButtonProps({
          selectedRole: 'admin',
          ...state,
        })}
      />
    ))
    .add('Button - Writer', () => state => (
      <RoleButton
        {...roleButtonProps({
          selectedRole: 'writer',
          ...state,
        })}
      />
    ))
    .add('Button - Reader', () => state => (
      <RoleButton
        {...roleButtonProps({
          selectedRole: 'reader',
          ...state,
        })}
      />
    ))
    .add('Button - with an attached picker', () => (state, setState) => (
      <FloatingRolePicker
        position="bottom center"
        open={state.opened}
        onCancel={() => setState({opened: false})}
        onLetIn={Sb.action('Let in')}
        {...roleButtonProps({
          ...state,
        })}
      >
        <RoleButton
          {...roleButtonProps({
            onClick: () => setState({opened: !state.opened}),
            ...state,
          })}
        />
      </FloatingRolePicker>
    ))
}

export default load
