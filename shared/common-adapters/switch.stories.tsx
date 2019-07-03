import * as React from 'react'
import Box, {Box2} from './box'
import Text from './text'
import Icon from './icon'
import ClickableBox from './clickable-box'
import Switch from './switch'
import * as Sb from '../stories/storybook'

const Kb = {
  Box,
  Box2,
  ClickableBox,
  Icon,
  Switch,
  Text,
}

class TestWrapper extends React.PureComponent<
  {
    align: 'left' | 'right'
    color: 'blue' | 'green'
    disabled?: boolean | null
    gapInBetween?: boolean | null
    initialEnabled: boolean
    label: string | React.ReactNode
    labelSubtitle?: string | null
    labelTooltip?: string | null
  },
  {
    on: boolean
  }
> {
  state = {on: this.props.initialEnabled}
  _onClick = () => this.setState(({on}) => ({on: !on}))
  render() {
    return (
      <Kb.Switch
        align={this.props.align}
        color={this.props.color}
        disabled={this.props.disabled}
        gapInBetween={this.props.gapInBetween}
        label={this.props.label}
        labelSubtitle={this.props.labelSubtitle}
        labelTooltip={this.props.labelTooltip}
        on={this.state.on}
        onClick={this._onClick}
        style={{width: 320}}
      />
    )
  }
}

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Switch', () => (
      <Kb.Box2 direction="vertical" gap="large" gapStart={true} centerChildren={true} fullWidth={true}>
        <TestWrapper
          align="left"
          key="left-align short text"
          label="left-align short text"
          color="blue"
          initialEnabled={true}
        />
        <TestWrapper
          align="right"
          key="right-align short text"
          label="right-align short text"
          color="blue"
          initialEnabled={true}
        />
        <TestWrapper
          align="right"
          key="right-align short text with gap"
          label="right-align short text with gap"
          gapInBetween={true}
          color="blue"
          initialEnabled={true}
        />
        <TestWrapper
          align="left"
          key="long-text"
          label={'long text '.repeat(20)}
          color="blue"
          initialEnabled={true}
        />
        <TestWrapper
          align="right"
          key="long-text right"
          label={'long text '.repeat(20)}
          color="blue"
          initialEnabled={true}
        />
        <TestWrapper
          align="left"
          key="with-tooltip"
          label="with tooltip"
          labelTooltip="This is a tooltip!"
          color="blue"
          initialEnabled={true}
        />
        <TestWrapper
          align="left"
          key="with-subtitle"
          label="This component is awesome!"
          labelSubtitle="Flip this if you think this component is awesome. Also let's make it longer so it wraps."
          color="green"
          initialEnabled={false}
        />
        <TestWrapper
          align="left"
          key="with-subtitle-and-tooltip"
          label="This component is awesome and it even supports tooltip can you believe it?"
          labelSubtitle="Flip this if you can believe it."
          labelTooltip="Don't you wanna flip it???"
          color="green"
          initialEnabled={false}
        />
        <TestWrapper
          align="left"
          key="custom-label"
          label={
            <Kb.Box2 direction="vertical">
              <Kb.Text type="Header">Custome weird label</Kb.Text>
              <Kb.Box2 direction="horizontal" fullWidth={true}>
                <Kb.Icon type="icon-file-32" />
                <Kb.Icon type="icon-folder-32" />
                <Kb.Icon type="icon-folder-private-32" />
                <Kb.Icon type="icon-folder-public-32" />
                <Kb.Icon type="icon-folder-team-32" />
              </Kb.Box2>
            </Kb.Box2>
          }
          color="blue"
          initialEnabled={true}
        />
        {(['blue', 'green'] as const).map(color =>
          [true, false, 'disabled'].map(i => {
            const initialEnabled = !!i
            const label = `${initialEnabled ? 'on' : 'off'}; ${color}${i === 'disabled' ? '; disabled' : ''}`
            return (
              <TestWrapper
                align="left"
                key={label}
                label={label}
                color={color}
                initialEnabled={initialEnabled}
                disabled={i === 'disabled'}
              />
            )
          })
        )}
      </Kb.Box2>
    ))
}

export default load
