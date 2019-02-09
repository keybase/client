// @flow
import {Box2} from './box'
import Button from './button'
import * as React from 'react'
import * as Sb from '../stories/storybook'
import {globalColors, isMobile} from '../styles'

const commonProps = {
  backgroundMode: 'Normal',
  disabled: false,
  fullWidth: false,
  label: 'label',
  labelStyle: null,
  onClick: Sb.action('onClick'),
  onMouseEnter: Sb.action('onMouseEnter'),
  onMouseLeave: Sb.action('onMouseLeave'),
  small: false,
  style: {alignSelf: undefined}, // button really shouldn't have this set
  waiting: false,
}

const Wrapper = ({children}) => (
  <Box2
    gap="small"
    direction={isMobile ? 'vertical' : 'horizontal'}
    gapStart={true}
    gapEnd={true}
    fullWidth={true}
  >
    {children}
  </Box2>
)

const types = ['Primary', 'Secondary', 'Danger', 'Wallet', 'PrimaryGreen', 'PrimaryGreenActive']
const backgroundModes = ['Red', 'Green', 'Blue', 'Black']
const modeToColor = {
  Black: globalColors.black,
  Blue: globalColors.blue,
  Green: globalColors.green,
  Red: globalColors.red,
}

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Button', () => (
      <Box2 direction="vertical" gap="small" gapStart={true} gapEnd={true}>
        {types.map(t => (
          <Wrapper key={t}>
            <Button {...commonProps} type={t} label={t} />
            <Button {...commonProps} type={t} label={t} disabled={true} />
            <Button {...commonProps} type={t} label={t} waiting={true} />
          </Wrapper>
        ))}
        <Wrapper>
          <Box2
            direction="vertical"
            gap="small"
            gapStart={true}
            gapEnd={true}
            style={{alignSelf: 'flex-start'}}
          >
            {types.map(t => (
              <Wrapper key={t}>
                <Button {...commonProps} type={t} label={t} small={true} />
                <Button {...commonProps} type={t} label={t} small={true} waiting={true} />
              </Wrapper>
            ))}
          </Box2>
        </Wrapper>
        <Wrapper>
          <Box2
            direction="vertical"
            gap="small"
            gapStart={true}
            gapEnd={true}
            style={{
              alignSelf: 'flex-start',
              borderColor: 'black',
              borderStyle: 'solid',
              borderWidth: 1,
              width: isMobile ? 220 : 400,
            }}
          >
            {types.map(t => (
              <Box2 direction="vertical" key={t} gap="small" fullWidth={true}>
                <Button {...commonProps} type={t} label={t} fullWidth={true} />
                <Button {...commonProps} type={t} label={t} fullWidth={true} waiting={true} />
              </Box2>
            ))}
          </Box2>
        </Wrapper>
        <Box2 direction="vertical" style={{alignSelf: 'flex-start'}}>
          {backgroundModes.map(b => (
            <Box2 direction="horizontal" key={b} style={{backgroundColor: modeToColor[b], padding: 20}}>
              <Button {...commonProps} type="PrimaryColoredBackground" label={b} backgroundMode={b} />
              <Button
                {...commonProps}
                type="PrimaryColoredBackground"
                label={b}
                backgroundMode={b}
                waiting={true}
              />
            </Box2>
          ))}
        </Box2>
      </Box2>
    ))
}

export default load
