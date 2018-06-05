// @flow
import Box from './box'
import Button from './button'
import * as React from 'react'
import {storiesOf, action} from '../stories/storybook'
import {globalColors, globalStyles} from '../styles'

const commonProps = {
  backgroundMode: 'Normal',
  disabled: false,
  fullWidth: false,
  label: 'label',
  labelStyle: null,
  onClick: action('onClick'),
  onMouseEnter: action('onMouseEnter'),
  onMouseLeave: action('onMouseLeave'),
  onPress: action('onPress'),
  small: false,
  style: {alignSelf: undefined}, // button really shouldn't have this set
  waiting: false,
}

type PairProps = {
  ...React.ElementProps<any>,
  background?: string,
}

const Pair = ({background, children}: PairProps) => (
  <Box style={{...globalStyles.flexBoxRow, width: '100%', marginBottom: 20, background: background || '', padding: background ? 4 : 0}}>
    <Box style={{flex: 1}}>{children[0]}</Box>
    <Box style={{flex: 1}}>{children[1]}</Box>
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
        width: 650,
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
      <Pair>
        <Button {...commonProps} type="Wallet" label="Wallet" />
        <Button {...commonProps} type="Wallet" label="Wallet" disabled={true} />
      </Pair>
      <Pair>
        <Button {...commonProps} type="PrimaryGreen" label="Primary Green" />
        <Button {...commonProps} type="PrimaryGreen" label="Primary Green" disabled={true} />
      </Pair>
      <Pair>
        <Button {...commonProps} type="PrimaryGreenActive" label="Primary Green Active" />
        <Button {...commonProps} type="PrimaryGreenActive" label="Primary Green Active" disabled={true} />
      </Pair>
      <Pair background={globalColors.red}>
        <Button {...commonProps} type="PrimaryColoredBackground" backgroundMode="Red" label="Primary Colored Background Red" />
        <Button {...commonProps} type="PrimaryColoredBackground" backgroundMode="Red" label="Primary Colored Background Red" disabled={true} />
      </Pair>
      <Pair background={globalColors.green}>
        <Button {...commonProps} type="PrimaryColoredBackground" backgroundMode="Green" label="Primary Colored Background Green" />
        <Button {...commonProps} type="PrimaryColoredBackground" backgroundMode="Green" label="Primary Colored Background Green" disabled={true} />
      </Pair>
      <Pair background={globalColors.blue}>
        <Button {...commonProps} type="PrimaryColoredBackground" backgroundMode="Blue" label="Primary Colored Background Blue" />
        <Button {...commonProps} type="PrimaryColoredBackground" backgroundMode="Blue" label="Primary Colored Background Blue" disabled={true} />
      </Pair>
      <Pair background={globalColors.black}>
        <Button {...commonProps} type="PrimaryColoredBackground" backgroundMode="Black" label="Primary Colored Background Black" />
        <Button {...commonProps} type="PrimaryColoredBackground" backgroundMode="Black" label="Primary Colored Background Black" disabled={true} />
      </Pair>
      <Pair background={globalColors.red}>
        <Button {...commonProps} type="SecondaryColoredBackground" label="Secondary Colored Background Red" />
        <Button {...commonProps} type="SecondaryColoredBackground" label="Secondary Colored Background Red" disabled={true} />
      </Pair>
      <Pair background={globalColors.green}>
        <Button {...commonProps} type="SecondaryColoredBackground" label="Secondary Colored Background Green" />
        <Button {...commonProps} type="SecondaryColoredBackground" label="Secondary Colored Background Green" disabled={true} />
      </Pair>
      <Pair background={globalColors.blue}>
        <Button {...commonProps} type="SecondaryColoredBackground" label="Secondary Colored Background Blue" />
        <Button {...commonProps} type="SecondaryColoredBackground" label="Secondary Colored Background Blue" disabled={true} />
      </Pair>
      <Pair background={globalColors.black}>
        <Button {...commonProps} type="SecondaryColoredBackground" label="Secondary Colored Background Black" />
        <Button {...commonProps} type="SecondaryColoredBackground" label="Secondary Colored Background Black" disabled={true} />
      </Pair>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'flex-start',
          alignSelf: 'flex-start',
          marginTop: 20,
        }}
      >
        <Button {...commonProps} type="Primary" label="Primary small" small={true} />
        <Box style={{height: 10}} />
        <Button {...commonProps} type="Secondary" label="Secondary small" small={true} />
        <Box style={{height: 10}} />
        <Button {...commonProps} type="Danger" label="Danger small" small={true} />
        <Box style={{height: 10}} />
        <Button {...commonProps} type="PrimaryGreen" label="Primary Green small" small={true} />
        <Box style={{height: 10}} />
        <Button {...commonProps} type="PrimaryGreenActive" label="Primary Green Active small" small={true} />
      </Box>
    </Box>
  ))
}

export default load
