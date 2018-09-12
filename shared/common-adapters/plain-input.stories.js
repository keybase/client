// @flow
import * as React from 'react'
import PlainInput from './plain-input'
import Box, {Box2} from './box'
import Button from './button'
import ButtonBar from './button-bar'
import Text from './text'
import {action, storiesOf} from '../stories/storybook'
import {globalColors, globalMargins} from '../styles'

const commonProps = {
  onBlur: action('onBlur'),
  onChangeText: action('onChangeText'),
  onClick: action('onClick'),
  onEnterKeyDown: action('onEnterKeyDown'),
  onFocus: action('onFocus'),
  onKeyDown: action('onKeyDown'),
  onKeyUp: action('onKeyUp'),
  style: {borderWidth: 1, borderStyle: 'solid', borderColor: globalColors.black_10},
}

type ControlledInputState = {[key: string]: string}
class ControlledInputPlayground extends React.Component<{}, ControlledInputState> {
  state = {}
  mutationTarget = React.createRef()
  _onChangeText = (valueKey: string) => (t: string) => this.setState({[valueKey]: t})
  _onChangeSelection = () => {
    if (this.mutationTarget.current) {
      const input = this.mutationTarget.current
      input.transformText(ti => ({text: ti.text, selection: {start: 2, end: 5}}))
      input.focus()
    }
  }
  _onTestCrossSelection = () => {
    if (this.mutationTarget.current) {
      const input = this.mutationTarget.current
      input.transformText(ti => ({text: '5char', selection: {start: 0, end: 0}}))
      input.transformText(ti => ({text: 'a lot more than 5 characters', selection: {start: 3, end: 5}}))
    }
  }
  render() {
    return (
      <Box2 direction="vertical" fullWidth={true} gap="small" style={{padding: globalMargins.small}}>
        <Text type="Body">Basic controlled inputs</Text>
        <PlainInput
          {...commonProps}
          value={this.state.value1 || ''}
          onChangeText={this._onChangeText('value1')}
          placeholder={`type="text"`}
        />
        <PlainInput
          {...commonProps}
          value={this.state.value2 || ''}
          onChangeText={this._onChangeText('value2')}
          type="password"
          placeholder={`type="password"`}
        />
        <PlainInput
          {...commonProps}
          value={this.state.value3 || ''}
          onChangeText={this._onChangeText('value3')}
          type="number"
          placeholder={`type="number" (desktop only)`}
        />
        <Box2 direction="vertical" fullWidth={true} gap="small">
          <Text type="Body">Live mutations</Text>
          <PlainInput
            {...commonProps}
            ref={this.mutationTarget}
            value={this.state.changingValue || ''}
            onChangeText={this._onChangeText('changingValue')}
          />
          <ButtonBar>
            <Button
              type="Secondary"
              label="Set value"
              onClick={() => this.setState({changingValue: 'reset value!'})}
            />
            <Button type="Secondary" label="Set selection" onClick={this._onChangeSelection} />
            <Button type="Secondary" label="Run test" onClick={this._onTestCrossSelection} />
          </ButtonBar>
        </Box2>
      </Box2>
    )
  }
}

const load = () => {
  storiesOf('Common/Plain input', module)
    .addDecorator(story => <Box style={{padding: 20}}>{story()}</Box>)
    .add('Basic', () => <PlainInput {...commonProps} />)
    .add('Different text type', () => <PlainInput {...commonProps} textType="BodyExtrabold" />)
    .add('Larger text type', () => <PlainInput {...commonProps} textType="HeaderBig" />)
    .add('Number', () => <PlainInput {...commonProps} type="number" />)
    .add('Password', () => <PlainInput {...commonProps} type="password" />)
    .add('Multiline', () => <PlainInput {...commonProps} multiline={true} />)
    .add('Multiline with row constraints', () => (
      <PlainInput {...commonProps} multiline={true} rowsMin={4} rowsMax={8} />
    ))
    .add('Flexable', () => (
      <Box2 direction="vertical" fullWidth={true} gap="medium">
        <Box2
          direction="horizontal"
          fullWidth={true}
          gap="small"
          style={{padding: 10, backgroundColor: globalColors.orange}}
        >
          <PlainInput {...commonProps} flexable={true} />
          <Box style={{width: 200, backgroundColor: globalColors.green}} />
        </Box2>
        <Text type="Body">Resize your window to see the text input flex</Text>
      </Box2>
    ))
    .add('With placeholder color', () => (
      <PlainInput {...commonProps} placeholder="I'm blue!" placeholderColor="blue" />
    ))

  // Sandbox for testing controlled input bugginess
  storiesOf('Common', module).add('Controlled input playground', () => <ControlledInputPlayground />)
}

export default load
