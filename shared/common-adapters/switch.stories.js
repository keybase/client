// @flow
import React from 'react'
import Box, {Box2} from './box'
import ClickableBox from './clickable-box'
import Switch from './switch'
import * as Sb from '../stories/storybook'

const Kb = {
  Box,
  Box2,
  ClickableBox,
  Switch,
}

class TestWrapper extends React.PureComponent<
  {
    align: 'left' | 'right',
    color: 'blue' | 'green',
    disabled?: ?boolean,
    initialEnabled: boolean,
    label: string,
  },
  {on: boolean}
> {
  state = {on: this.props.initialEnabled}
  _onClick = () => this.setState(({on}) => ({on: !on}))
  render() {
    return (
      <Kb.Switch
        align={this.props.align}
        color={this.props.color}
        disabled={this.props.disabled}
        label={this.props.label}
        on={this.state.on}
        onClick={this._onClick}
        style={{width: 320}}
      />
    )
  }
}

const load = () => {
  Sb.storiesOf('Common', module).add('Switch', () => (
    <Kb.Box2 direction="vertical" gap="large" gapStart={true} centerChildren={true} fullWidth={true}>
      {['left', 'right'].map(align =>
        ['blue', 'green'].map(color =>
          [true, false, 'disabled'].map(i => {
            const initialEnabled = !!i
            const label = `${align} aligned; ${initialEnabled ? 'on' : 'off'}; ${color}${
              i === 'disabled' ? '; disabled' : ''
            }`
            return (
              <TestWrapper
                align={align}
                key={label}
                label={label}
                color={color}
                initialEnabled={initialEnabled}
                disabled={i === 'disabled'}
              />
            )
          })
        )
      )}
    </Kb.Box2>
  ))
}

export default load
