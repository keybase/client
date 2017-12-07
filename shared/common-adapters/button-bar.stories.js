// @flow
import Box from './box'
import Button from './button'
import ButtonBar from './button-bar'
import * as React from 'react'
import {storiesOf, action} from '../stories/storybook'

const commonButtonProps = {
  backgroundMode: 'Normal',
  disabled: false,
  fullWidth: false,
  label: 'Button',
  onClick: action('onClick'),
  onMouseEnter: action('onMouseEnter'),
  onMouseLeave: action('onMouseLeave'),
  onPress: action('onPress'),
  small: false,
  style: {alignSelf: undefined}, // button really shouldn't have this set
  waiting: false,
}

const commonButtonBarProps = {
  style: {
    borderColor: 'pink',
    borderStyle: 'solid',
    borderWidth: 1,
  },
}

const load = () => {
  storiesOf('Common', module).add('ButtonBar', () => (
    <Box
      style={{
        borderColor: 'grey',
        borderStyle: 'solid',
        borderWidth: 1,
        flex: 1,
        maxWidth: 600,
        width: '100%',
      }}
    >
      <ButtonBar {...commonButtonBarProps} direction="row">
        <Button {...commonButtonProps} type="Primary" label="Button" />
      </ButtonBar>
      <ButtonBar {...commonButtonBarProps} direction="row">
        <Button {...commonButtonProps} type="Secondary" />
        <Button {...commonButtonProps} type="Primary" label="Another button" />
      </ButtonBar>
      <ButtonBar {...commonButtonBarProps} direction="column">
        <Button {...commonButtonProps} type="Primary" />
      </ButtonBar>
      <ButtonBar {...commonButtonBarProps} direction="column">
        <Button {...commonButtonProps} type="Secondary" />
        <Button {...commonButtonProps} type="Primary" label="Another button" />
      </ButtonBar>
      <ButtonBar {...commonButtonBarProps} direction="row" align="flex-start">
        <Button {...commonButtonProps} type="Primary" />
      </ButtonBar>
      <ButtonBar {...commonButtonBarProps} direction="row" align="flex-end">
        <Button {...commonButtonProps} type="Primary" />
      </ButtonBar>
      <ButtonBar {...commonButtonBarProps} direction="row" small={true}>
        <Button {...commonButtonProps} type="Primary" label="Small button" small={true} />
      </ButtonBar>
      <ButtonBar {...commonButtonBarProps} direction="row" small={true}>
        <Button {...commonButtonProps} type="Secondary" label="Small button" small={true} />
        <Button {...commonButtonProps} type="Primary" label="Small button" small={true} />
      </ButtonBar>
      <ButtonBar {...commonButtonBarProps} direction="column" fullWidth={true}>
        <Button {...commonButtonProps} type="Primary" />
      </ButtonBar>
    </Box>
  ))
}

export default load
