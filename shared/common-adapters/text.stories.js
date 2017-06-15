// @flow
import {storiesOf} from '@storybook/react'
import React from 'react'
import {globalColors, globalStyles} from '../styles'

import Text from './text'

const SmallGap = () => <div style={{minHeight: 24}} />
const LargeGap = () => <div style={{minHeight: 36}} />

const displayBlock = {
  style: {display: 'block'},
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
  <div
    style={{
      ...globalStyles.flexBoxRow,
      ...globalStyles.fillAbsolute,
      bottom: undefined,
      flex: 1,
      height: 30,
    }}
  >
    <div style={{backgroundColor: globalColors.midnightBlue, flex: 1}} />
    <div style={{backgroundColor: globalColors.blue, flex: 1}} />
    <div style={{backgroundColor: globalColors.red, flex: 1}} />
    <div style={{backgroundColor: globalColors.green, flex: 1}} />
    <div style={{backgroundColor: globalColors.darkBlue, flex: 1}} />
  </div>
)

const Container = ({backgroundColor, children}) => (
  <div
    style={{
      backgroundColor,
      padding: 90,
      position: 'relative',
    }}
  >
    {children}
  </div>
)

const groups = [
  [{label: 'Header big Header big', type: 'HeaderBig'}],
  [
    {label: 'Header Header', type: 'Header'},
    {label: 'Header link Header link', normalOnly: true, type: 'HeaderLink'},
  ],
  [
    {label: 'Body big Body big', type: 'BodyBig'},
    {label: 'Body big link Body big link', normalOnly: true, type: 'BodyBigLink'},
  ],
  [
    {label: 'Body text Body text Body text', type: 'Body'},
    {label: 'Body semibold Body semibold', type: 'BodySemibold'},
    {label: 'Body primary link', type: 'BodyPrimaryLink'},
    {label: 'Body secondary link', normalOnly: true, type: 'BodySecondaryLink'},
    {label: 'Body error Body error', normalOnly: true, type: 'BodyError'},
    {label: 'Body success Body success', normalOnly: true, type: 'BodySuccess'},
  ],
  [
    {label: 'Body small Body small', type: 'BodySmall'},
    {label: 'Body small semibold', type: 'BodySmallSemibold'},
    {label: 'Body small primary link', type: 'BodySmallPrimaryLink'},
    {label: 'Body small secondary link', normalOnly: true, type: 'BodySmallSecondaryLink'},
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

storiesOf('Text Sheet', module).add('Text', () => (
  <div style={{display: 'grid', flex: 1, gridTemplateColumns: 'repeat(2, 1fr)', overflow: 'auto'}}>
    <Container backgroundColor={globalColors.white}>
      {mapText(false)}
    </Container>
    <Container backgroundColor={globalColors.midnightBlue}>
      <SecondaryColorBox />
      {mapText(true)}
    </Container>
  </div>
))
