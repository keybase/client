// @flow
import Box from './box'
import Text from './text'
import Button from './button'
import * as React from 'react'
import {storiesOf, action} from '../stories/storybook'
import {globalStyles} from '../styles'

const commonProps = {
  // type: 'Primary' | 'PrimaryPrivate' | 'Secondary' | 'Danger' | 'Follow' | 'Following' | 'Unfollow',
  backgroundMode: 'Normal', // | 'Terminal',
  className: null,
  disabled: false,
  fullWidth: false,
  label: 'label',
  labelStyle: null,
  onClick: action('onClick'),
  onMouseEnter: action('onMouseEnter'),
  onMouseLeave: action('onMouseLeave'),
  onPress: action('onPress'),
  small: false,
  style: null,
  waiting: false,
}

const Pair = ({children}) => (
  <Box style={{...globalStyles.flexBoxRow, width: '100%', marginBottom: 20}}>
    <Box style={{flex: 1}}>
      {children[0]}
    </Box>
    <Box style={{flex: 1}}>
      {children[1]}
    </Box>
  </Box>
)

const load = () => {
  storiesOf('Common', module).add('Button', () => (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        borderColor: 'grey',
        borderStyle: 'solid',
        borderWidth: 1,
        flex: 1,
        margin: 20,
        width: 350,
      }}
    >
      <Pair>
        <Button {...commonProps} type="Primary" label="Primary" />
        <Button {...commonProps} type="Primary" label="Primary" disabled={true} />
      </Pair>
      <Pair>
        <Button {...commonProps} type="Secondary" label="Secondary" />
        <Button {...commonProps} type="Secondary" label="Secondary" disabled={true} />
      </Pair>
      <Pair>
        <Button {...commonProps} type="Danger" label="Danger" />
        <Button {...commonProps} type="Danger" label="Danger" disabled={true} />
      </Pair>
      <Box style={{height: 20}} />
      <Button {...commonProps} type="Following" label="Following" />
      <Box style={{height: 10}} />
      <Button {...commonProps} type="Follow" label="Follow" />
      <Box style={{height: 10}} />
      <Button {...commonProps} type="Unfollow" label="Unfollow" />
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          marginTop: 20,
          alignItems: 'flex-start',
          alignSelf: 'flex-start',
        }}
      >
        <Text type="Body">These are align-self center hence not being left aligned. TODO fix that</Text>
        <Button {...commonProps} type="Primary" label="Primary" small={true} />
        <Box style={{height: 10}} />
        <Button {...commonProps} type="Secondary" label="Secondary" small={true} />
        <Box style={{height: 10}} />
        <Button {...commonProps} type="Danger" label="Danger" small={true} />
      </Box>
    </Box>
  ))
}

export default load
