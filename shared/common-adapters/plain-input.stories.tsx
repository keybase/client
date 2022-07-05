import * as React from 'react'
import PlainInput from './plain-input'
import Box, {Box2} from './box'
import Button from './button'
import ButtonBar from './button-bar'
import Text from './text'
import {action, scrollViewDecorator, storiesOf} from '../stories/storybook'
import {globalColors, globalMargins} from '../styles'

const commonProps = {
  onBlur: action('onBlur'),
  onChangeText: action('onChangeText'),
  onClick: action('onClick'),
  onEnterKeyDown: action('onEnterKeyDown'),
  onFocus: action('onFocus'),
  onKeyDown: action('onKeyDown'),
  onKeyUp: action('onKeyUp'),
  style: {borderColor: globalColors.black_10, borderStyle: 'solid' as 'solid', borderWidth: 1},
}

class TestInput extends React.Component<
  {
    maxBytes?: number
    multiline: boolean
  },
  {
    value: string
  }
> {
  state = {value: ''}
  _input = React.createRef<PlainInput>()

  _insertText = (t: string) => {
    const input = this._input.current
    if (input) {
      const selection = input.getSelection()
      if (selection) {
        this.setState(
          s => {
            const value =
              s.value.substring(0, selection.start || 0) + t + s.value.substring(selection.end || 0)
            return {value}
          },
          () => {
            const input = this._input.current
            if (input) {
              const newCursorPos = (selection.start || 0) + t.length
              input.setSelection({end: newCursorPos, start: newCursorPos})
              input.focus()
            }
          }
        )
      }
    }
  }

  render() {
    return (
      <Box2 direction="vertical" fullWidth={true} gap="small">
        <PlainInput
          {...commonProps}
          ref={this._input}
          value={this.state.value}
          maxBytes={this.props.maxBytes}
          multiline={this.props.multiline}
          onEnterKeyDown={() => this._insertText('foo')}
          onChangeText={v => this.setState(s => (s.value === v ? null : {value: v}))}
        />
        <ButtonBar>
          <Button type="Dim" label="Insert 'foo' (Enter)" onClick={() => this._insertText('foo')} />
        </ButtonBar>
      </Box2>
    )
  }
}

type ControlledInputState = {value1: string; value2: string; changingValue: string}

class ControlledInputPlayground extends React.Component<
  {
    maxBytes?: number
    multiline: boolean
  },
  ControlledInputState
> {
  state = {
    changingValue: '',
    value1: '',
    value2: '',
  }
  mutationTarget = React.createRef<PlainInput>()
  // @ts-ignore not sure
  _onChangeText = (valueKey: keyof ControlledInputState) => (t: string) => this.setState({[valueKey]: t})

  _onChangeChangingValue = (t: string) => this.setState({changingValue: t})
  _testChangingSelection = () => {
    if (this.mutationTarget.current) {
      const input = this.mutationTarget.current
      input.focus()
      input.setSelection({end: 5, start: 2})
    }
  }
  _testCrossSelection = () => {
    if (this.mutationTarget.current) {
      const input = this.mutationTarget.current
      input.focus()
      this.setState({changingValue: '5char'}, () => {
        this.forceUpdate(() => {
          if (this.mutationTarget.current) {
            const input = this.mutationTarget.current
            input.setSelection({end: 0, start: 0})
            this.setState({changingValue: 'a lot more than 5 characters'})
            this.forceUpdate(() => {
              if (this.mutationTarget.current) {
                const input = this.mutationTarget.current
                input.setSelection({end: 5, start: 3})
              }
            })
          }
        })
      })
    }
  }
  render() {
    const common = {...commonProps, maxBytes: this.props.maxBytes, multiline: this.props.multiline}
    return (
      <Box2 direction="vertical" fullWidth={true} gap="small" style={{padding: globalMargins.small}}>
        <Text type="Body">Basic controlled inputs</Text>
        <PlainInput
          {...common}
          value={this.state.value1 || ''}
          onChangeText={this._onChangeText('value1')}
          placeholder={`type="text"`}
        />
        <PlainInput
          {...common}
          value={this.state.value2 || ''}
          onChangeText={this._onChangeText('value2')}
          type="password"
          placeholder={`type="password"`}
        />
        <Box2 direction="vertical" fullWidth={true} gap="small">
          <Text type="Body">Live mutations</Text>
          <PlainInput
            {...common}
            ref={this.mutationTarget}
            value={this.state.changingValue || ''}
            onChangeText={this._onChangeChangingValue}
          />
          <ButtonBar>
            <Button
              type="Dim"
              label="Set value"
              onClick={() => this.setState({changingValue: 'reset value!'})}
            />
            <Button type="Dim" label="Set selection" onClick={this._testChangingSelection} />
            <Button type="Dim" label="Run test" onClick={this._testCrossSelection} />
          </ButtonBar>
        </Box2>
        <TestInput maxBytes={this.props.maxBytes} multiline={this.props.multiline} />
      </Box2>
    )
  }
}

const load = () => {
  storiesOf('Common/Plain input', module)
    .addDecorator(story => <Box style={{padding: 20}}>{story()}</Box>)
    .addDecorator(scrollViewDecorator)
    .add('Basic', () => <PlainInput {...commonProps} />)
    .add('Max Length=10', () => <PlainInput {...commonProps} maxLength={10} />)
    .add('Different text type', () => <PlainInput {...commonProps} textType="BodyExtrabold" />)
    .add('Larger text type', () => <PlainInput {...commonProps} textType="HeaderBig" />)
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
          style={{backgroundColor: globalColors.orange, padding: 10}}
        >
          <PlainInput {...commonProps} flexable={true} />
          <Box style={{backgroundColor: globalColors.green, width: 200}} />
        </Box2>
        <Text type="Body">Resize your window to see the text input flex</Text>
      </Box2>
    ))
    .add('With placeholder color', () => (
      <PlainInput {...commonProps} placeholder="I'm blue!" placeholderColor="blue" />
    ))
    // Sandbox for testing controlled input bugginess
    .add('Controlled input playground', () => <ControlledInputPlayground multiline={false} />)
    .add('Controlled input playground (maxBytes=10)', () => (
      <ControlledInputPlayground multiline={false} maxBytes={10} />
    ))
    .add('Controlled input playground (multiline)', () => <ControlledInputPlayground multiline={true} />)
}

export default load
