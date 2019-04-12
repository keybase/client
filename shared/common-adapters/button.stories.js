// @flow
import {Box2} from './box'
import Text from './text'
import Button from './button'
import * as React from 'react'
import * as Sb from '../stories/storybook'
import {globalColors, isMobile} from '../styles'

const commonProps = {
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
    alignItems="center"
    direction={isMobile ? 'vertical' : 'horizontal'}
    gapStart={true}
    gapEnd={true}
    fullWidth={true}
  >
    {children}
  </Box2>
)

const types = ['Default', 'Success', 'Danger', 'Wallet', 'Dim']
const backgroundColors = ['blue', 'red', 'green', 'purple', 'black']
const bgToColor = {
  black: globalColors.black,
  blue: globalColors.blue,
  green: globalColors.green,
  purple: globalColors.purple2,
  red: globalColors.red,
}

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Button', () => (
      <Box2 direction="vertical" gap="small" gapStart={true} gapEnd={true}>
        {types.map(t => (
          <Wrapper key={t}>
            <Text type="BodySemibold" style={{width: 60}}>
              {t}
            </Text>
            <Button {...commonProps} type={t} label="Primary" mode="Primary" />
            <Button {...commonProps} type={t} label="Secondary" mode="Secondary" />
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
          {backgroundColors.map(b => (
            <Box2
              direction="horizontal"
              key={b}
              style={{backgroundColor: bgToColor[b], padding: 20, width: '100%'}}
            >
              <Button {...commonProps} mode="Primary" backgroundColor={b} label={b} />
              <Button {...commonProps} mode="Secondary" backgroundColor={b} label={b} />
            </Box2>
          ))}
        </Box2>
      </Box2>
    ))
}

export default load
