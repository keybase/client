// @flow
import * as React from 'react'
import Button from './button'
import Input, {type Props} from './input'
import Box from './box'
import {action, storiesOf} from '../stories/storybook'
import {globalStyles} from '../styles'

const commonProps: Props = {
  onBlur: action('onBlur'),
  onChangeText: action('onChangeText'),
  onClick: action('onClick'),
  onEnterKeyDown: action('onEnterKeyDown'),
  onFocus: action('onFocus'),
  onKeyDown: e => {
    action('onKeyDown')(e.key)
  },
  onKeyUp: e => {
    action('onKeyUp')(e.key)
  },
  onSelectionChange: action('onSelectionChange'),
}

type UncontrolledTestProps = {}

class UncontrolledTestInput extends React.Component<UncontrolledTestProps> {
  _input: ?Input

  _setInput = (ref: ?Input) => {
    this._input = ref
  }

  _insertText = () => {
    if (this._input) {
      this._input.transformText(textInfo => {
        return {
          text: textInfo.text + 'foo',
          selection: textInfo.selection,
        }
      })
    }
  }

  render = () => {
    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          width: 420,
        }}
      >
        <Input {...commonProps} uncontrolled={true} ref={this._setInput} />
        <Button type="Primary" label="Insert &quot;foo&quot;" onClick={this._insertText} />
      </Box>
    )
  }
}

const load = () => {
  storiesOf('Common/Input', module)
    .add('Empty (uncontrolled)', () => <UncontrolledTestInput />)
    .add('Filled', () => <Input {...commonProps} value="Hello, World!" />)
    .add('Filled Centered', () => (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          backgroundColor: 'yellow',
          width: 420,
        }}
      >
        <Input {...commonProps} value="Hello, World!" />
      </Box>
    ))
    .add('Filled Stretched', () => (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'stretch',
          backgroundColor: 'green',
          width: 420,
        }}
      >
        <Input {...commonProps} value="Hello, World!" />
      </Box>
    ))
    .add('Filled style override', () => (
      <Input {...commonProps} value="Hello, World!" style={{backgroundColor: 'red'}} />
    ))
    .add('Filled input style override', () => (
      <Input {...commonProps} value="Hello, World!" inputStyle={{backgroundColor: 'red'}} />
    ))
    .add('No underline', () => <Input {...commonProps} hideUnderline={true} />)
    .add('Hint empty', () => <Input {...commonProps} hint="hint" />)
    .add('Floating label empty', () => <Input {...commonProps} floatingHintTextOverride="floating" />)
    .add('Single line', () => <Input {...commonProps} />)
    .add('Auto cap none', () => <Input {...commonProps} autoCapitalize="none" />)
    .add('Auto cap words', () => <Input {...commonProps} autoCapitalize="words" />)
    .add('Auto cap sentences', () => <Input {...commonProps} autoCapitalize="sentences" />)
    .add('Auto cap characters', () => <Input {...commonProps} autoCapitalize="characters" />)
    .add('Autocorrect', () => <Input {...commonProps} autoCorrect={true} />)
    .add('Password', () => <Input {...commonProps} type="password" />)
    .add('Floating label filled', () => (
      <Input {...commonProps} floatingHintTextOverride="Hello..." value="Hello, World!" />
    ))
    .add('Floating label filled error', () => (
      <Input
        {...commonProps}
        floatingHintTextOverride="Hello..."
        value="Hello, World!"
        errorText="Check your spelling"
      />
    ))
    .add('Error styled', () => (
      <Input
        {...commonProps}
        floatingHintTextOverride="Hello..."
        value="Hello, World!"
        errorText="Check your spelling"
        errorStyle={{
          backgroundColor: 'blue',
          padding: 20,
        }}
      />
    ))
    .add('Visible password', () => (
      <Input {...commonProps} type="passwordVisible" floatingHintTextOverride="shh..." value="secret" />
    ))
    .add('Floating Label Hint Empty', () => (
      <Input {...commonProps} hintText={'Hello!'} floatingHintTextOverride={'Hello...'} />
    ))
    .add('Multi Label Styled', () => (
      <Input
        {...commonProps}
        hintText={'Hello!'}
        multiline={true}
        value={'multi styled'}
        inputStyle={{color: 'blue'}}
      />
    ))
    .add('Hint Multiline Empty', () => (
      <Input
        {...commonProps}
        hintText={'This is a very long hint that will hopefully wrap to two lines or more more more!'}
        multiline={true}
      />
    ))
    .add('Long Multiline', () => (
      <Input
        {...commonProps}
        value={
          'This is a very long text that will hopefully wrap to two lines or more more more! or more or more or more or more or more or more or more or more or more or more or more or more or more or more!'
        }
        multiline={true}
      />
    ))
    .add('Long Multiline rowsMax1', () => (
      <Input
        {...commonProps}
        value={
          'This is a very long text that will hopefully wrap to two lines or more more more! or more or more or more or more or more or more or more or more or more or more or more or more or more or more!'
        }
        multiline={true}
        rowsMax={1}
      />
    ))
    .add('Long Multiline rowsMax2', () => (
      <Input
        {...commonProps}
        value={
          'This is a very long text that will hopefully wrap to two lines or more more more! or more or more or more or more or more or more or more or more or more or more or more or more or more or more!'
        }
        multiline={true}
        rowsMax={2}
      />
    ))
    .add('Long Multiline rowsMax4', () => (
      <Input
        {...commonProps}
        value={
          'This is a very long text that will hopefully wrap to two laxes or more more more! or more or more or more or more or more or more or more or more or more or more or more or more or more or more!'
        }
        multiline={true}
        rowsMax={4}
      />
    ))
    .add('Long Multiline rowsMin2Max4 small', () => (
      <Input {...commonProps} value={'This is a small text'} multiline={true} rowsMin={2} rowsMax={4} />
    ))
    .add('Long Multiline rowsMin2Max4 long', () => (
      <Input
        {...commonProps}
        value={
          'This is a very long text that will hopefully wrap to two lines or more more more! or more or more or more or more or more or more or more or more or more or more or more or more or more or more!'
        }
        multiline={true}
        rowsMin={2}
        rowsMax={4}
      />
    ))
    .add('Long Multiline rowsMin1', () => (
      <Input {...commonProps} value={'This is a small text'} multiline={true} rowsMin={1} />
    ))
    .add('Long Multiline rowsMin2', () => (
      <Input {...commonProps} value={'This is a small text'} multiline={true} rowsMin={2} />
    ))
    .add('Long Multiline rowsMin4', () => (
      <Input {...commonProps} value={'This is a small text'} multiline={true} rowsMin={4} />
    ))
    .add('Multiline error', () => (
      <Input
        {...commonProps}
        value={'This is a multiline with error'}
        multiline={true}
        errorText={'this is an error'}
      />
    ))
    .add('Floating Label Multiline Empty', () => (
      <Input {...commonProps} floatingHintTextOverride={'Hello...'} multiline={true} />
    ))
    .add('Floating Label Multiline Filled', () => (
      <Input
        {...commonProps}
        floatingHintTextOverride={'Hello...'}
        multiline={true}
        value={'Hello, World!'}
      />
    ))
    .add('Floating Label Multiline Filled Long', () => (
      <Input
        {...commonProps}
        floatingHintTextOverride={'Hello...'}
        multiline={true}
        value={'Hello,\nMy name is Max\nHow are you?'}
      />
    ))
    .add('Small Empty', () => <Input {...commonProps} small={true} smallLabel={'Small:'} />)
    .add('Small Filled', () => (
      <Input {...commonProps} small={true} value={'Hello, World!'} smallLabel={'Small:'} />
    ))
    .add('Small styled', () => (
      <Input
        {...commonProps}
        small={true}
        value={'Hello, World!'}
        smallLabel={'Small:'}
        inputStyle={{color: 'blue'}}
      />
    ))
    .add('Small Hint Empty', () => (
      <Input {...commonProps} small={true} smallLabel={'Small:'} hintText={'Hello...'} />
    ))
    .add('Small Label Empty', () => <Input {...commonProps} small={true} hintText={'Hello...'} />)
    .add('Small Label Styled', () => (
      <Input
        {...commonProps}
        small={true}
        smallLabel={'Styled:'}
        smallLabelStyle={{backgroundColor: 'blue'}}
        hintText={'Hello...'}
      />
    ))
    .add('Small Hint Error', () => (
      <Input
        {...commonProps}
        small={true}
        smallLabel={'Small:'}
        value={'has an error'}
        hintText={'Hello...'}
        errorText={'this is invisible in the small input'}
      />
    ))
}

export default load
