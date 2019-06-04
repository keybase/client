import Box from './box'
import Button from './button'
import ButtonBar from './button-bar'
import * as React from 'react'
import * as Sb from '../stories/storybook'

const commonButtonProps = {
  disabled: false,
  fullWidth: false,
  label: 'Button',
  onClick: Sb.action('onClick'),
  onMouseEnter: Sb.action('onMouseEnter'),
  onMouseLeave: Sb.action('onMouseLeave'),
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
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('ButtonBar', () => (
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
          <Button {...commonButtonProps} mode="Primary" label="Button" />
        </ButtonBar>
        <ButtonBar {...commonButtonBarProps} direction="row">
          <Button {...commonButtonProps} mode="Secondary" />
          <Button {...commonButtonProps} mode="Primary" label="Another button" />
        </ButtonBar>
        <ButtonBar {...commonButtonBarProps} direction="column">
          <Button {...commonButtonProps} mode="Primary" />
        </ButtonBar>
        <ButtonBar {...commonButtonBarProps} direction="column">
          <Button {...commonButtonProps} mode="Secondary" />
          <Button {...commonButtonProps} mode="Primary" label="Another button" />
        </ButtonBar>
        <ButtonBar {...commonButtonBarProps} direction="row" align="flex-start">
          <Button {...commonButtonProps} mode="Primary" />
        </ButtonBar>
        <ButtonBar {...commonButtonBarProps} direction="row" align="flex-end">
          <Button {...commonButtonProps} mode="Primary" />
        </ButtonBar>
        <ButtonBar {...commonButtonBarProps} direction="row" small={true}>
          <Button {...commonButtonProps} mode="Primary" label="Small button" small={true} />
        </ButtonBar>
        <ButtonBar {...commonButtonBarProps} direction="row" small={true}>
          <Button {...commonButtonProps} mode="Secondary" label="Small button" small={true} />
          <Button {...commonButtonProps} mode="Primary" label="Small button" small={true} />
        </ButtonBar>
        <ButtonBar {...commonButtonBarProps} direction="column" fullWidth={true}>
          <Button {...commonButtonProps} mode="Primary" />
        </ButtonBar>
        <ButtonBar {...commonButtonBarProps} direction="row">
          <Button {...commonButtonProps} mode="Secondary" fullWidth={true} />
          <Button {...commonButtonProps} mode="Primary" fullWidth={true} />
        </ButtonBar>
      </Box>
    ))
}
// style={{flexGrow: 1}}

export default load
