// @flow
import Box from './box'
import React from 'react'
import Text from './text'
import {globalColors, globalStyles} from '../styles'
import {storiesOf, action} from '../stories/storybook'
import {isMobile} from '../constants/platform'

const SmallGap = () => <Box style={{minHeight: 24}} />
const LargeGap = () => <Box style={{minHeight: 36}} />

const displayBlock = {
  style: isMobile ? {} : {display: 'block'},
}
const foregroundMode = {
  backgroundMode: 'Normal',
}
const backgroundMode = {
  backgroundMode: 'Terminal',
}
const hidden = {
  style: {opacity: 0},
}
const SecondaryColorBox = () => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      ...globalStyles.fillAbsolute,
      bottom: undefined,
      flex: 1,
      height: 30,
    }}
  >
    <Box style={{backgroundColor: globalColors.midnightBlue, flex: 1}} />
    <Box style={{backgroundColor: globalColors.blue, flex: 1}} />
    <Box style={{backgroundColor: globalColors.red, flex: 1}} />
    <Box style={{backgroundColor: globalColors.green, flex: 1}} />
    <Box style={{backgroundColor: globalColors.darkBlue, flex: 1}} />
  </Box>
)

const Container = ({backgroundColor, children}) => (
  <Box
    style={{
      backgroundColor,
      padding: isMobile ? 10 : 90,
      position: 'relative',
    }}
  >
    {children}
  </Box>
)

const groups = [
  [{label: 'Header big Header big', type: 'HeaderBig'}],
  [
    {label: 'Header Header', type: 'Header'},
    {action: true, label: 'Header link Header link', normalOnly: true, type: 'HeaderLink'},
  ],
  [
    {label: 'Body big Body big', type: 'BodyBig'},
    {action: true, label: 'Body big link Body big link', normalOnly: true, type: 'BodyBigLink'},
  ],
  [
    {label: 'Body text Body text Body text', type: 'Body'},
    {label: 'Body semibold Body semibold', type: 'BodySemibold'},
    {action: true, label: 'Body primary link', type: 'BodyPrimaryLink'},
    {action: true, label: 'Body secondary link', normalOnly: true, type: 'BodySecondaryLink'},
    {label: 'Body error Body error', normalOnly: true, type: 'BodyError'},
    {label: 'Body success Body success', normalOnly: true, type: 'BodySuccess'},
  ],
  [
    {label: 'Body small Body small', type: 'BodySmall'},
    {action: true, label: 'Body small semibold', type: 'BodySmallSemibold'},
    {action: true, label: 'Body small primary link', type: 'BodySmallPrimaryLink'},
    {action: true, label: 'Body small secondary link', normalOnly: true, type: 'BodySmallSecondaryLink'},
    {label: 'Body small error Body small error', normalOnly: true, type: 'BodySmallError'},
    {label: 'Body small success Body small success', normalOnly: true, type: 'BodySmallSuccess'},
  ],
]

const mapText = (secondary: boolean) => {
  const items = []

  groups.forEach((group, gidx) => {
    group.forEach(types => {
      const item = key => (
        <Text
          type={types.type}
          onClick={types.action ? action(`${types.type} clicked`) : undefined}
          key={key}
          {...{
            ...displayBlock,
            ...(secondary ? backgroundMode : foregroundMode),
            ...(secondary && types.normalOnly ? hidden : null),
          }}
        >
          {types.label}
        </Text>
      )
      items.push(item(types.type + '1'))
      items.push(item(types.type + '2'))
      items.push(<SmallGap key={types.type} />)
    })
    items.push(<LargeGap key={gidx} />)
  })

  return items
}

const load = () => {
  storiesOf('Text', module).add('Text', () => (
    <Box style={outterStyle}>
      <Container backgroundColor={globalColors.white}>
        {mapText(false)}
      </Container>
      <Container backgroundColor={globalColors.midnightBlue}>
        <SecondaryColorBox />
        {mapText(true)}
      </Container>
    </Box>
  ))
}

const outterStyle = isMobile
  ? {}
  : {display: 'grid', flex: 1, gridTemplateColumns: 'repeat(2, 1fr)', overflow: 'auto'}

export default load
