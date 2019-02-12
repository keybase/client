// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import Box from './box'
import Text, {allTextTypes} from './text'
import {globalColors, globalStyles, isMobile, platformStyles} from '../styles'

const SmallGap = () => <Box style={{minHeight: 24}} />
const LargeGap = () => <Box style={{minHeight: 36}} />

const displayBlock = {
  style: platformStyles({
    isElectron: {
      display: 'block',
    },
  }),
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
    <Box style={{backgroundColor: globalColors.darkBlue3, flex: 1}} />
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
  [{label: 'Header big extrabold', type: 'HeaderBigExtrabold'}],
  [
    {label: 'Header Header', type: 'Header'},
    {label: 'Header Extrabold', type: 'HeaderExtrabold'},
    {action: true, label: 'Header link Header link', normalOnly: true, type: 'HeaderLink'},
  ],
  [
    {label: 'Body big Body big', type: 'BodyBig'},
    {action: true, label: 'Body big link Body big link', normalOnly: true, type: 'BodyBigLink'},
  ],
  [
    {label: 'Body text Body text Body text', type: 'Body'},
    {label: 'Body semibold Body semibold', type: 'BodySemibold'},
    {label: 'Body extrabold Body extrabold', type: 'BodyExtrabold'},
    {action: true, label: 'Body primary link', type: 'BodyPrimaryLink'},
    {action: true, label: 'Body secondary link', normalOnly: true, type: 'BodySecondaryLink'},
  ],
  [
    {label: 'Body small Body small', type: 'BodySmall'},
    {label: 'Body small bold Body small bold', type: 'BodySmallBold'},
    {label: 'Body small extrabold Body small extrabold', type: 'BodySmallExtrabold'},
    {label: 'Body small semibold', type: 'BodySmallSemibold'},
    {action: true, label: 'Body small primary link semibold', type: 'BodySmallSemiboldPrimaryLink'},
    {action: true, label: 'Body small primary link', type: 'BodySmallPrimaryLink'},
    {action: true, label: 'Body small secondary link', normalOnly: true, type: 'BodySmallSecondaryLink'},
    {
      action: true,
      label: 'Body small secondary link extrabold',
      normalOnly: true,
      type: 'BodySmallExtraboldSecondaryLink',
    },
    {label: 'Body small error Body small error', normalOnly: true, type: 'BodySmallError'},
    {label: 'Body small success Body small success', normalOnly: true, type: 'BodySmallSuccess'},
    {label: 'Body small wallet Body small wallet', normalOnly: true, type: 'BodySmallWallet'},
  ],
  [{label: 'Body tiny Body tiny', type: 'BodyTiny'}, {label: 'Body tiny semibold', type: 'BodyTinySemibold'}],
]

const mapText = (secondary: boolean) => {
  const items = []

  groups.forEach((group, gidx) => {
    group.forEach(types => {
      const item = key => (
        <Text
          type={types.type}
          onClick={types.action ? Sb.action(`${types.type} clicked`) : undefined}
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
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Text', () => (
      <Box style={outerStyle}>
        <Container backgroundColor={globalColors.white}>{mapText(false)}</Container>
        <Container backgroundColor={globalColors.darkBlue3}>
          <SecondaryColorBox />
          {mapText(true)}
        </Container>
      </Box>
    ))
    .add('TextAll', () => (
      <>
        {Object.keys(allTextTypes).map(t => (
          <Box key={t}>
            <Text type={t}>{t}</Text>
          </Box>
        ))}
      </>
    ))
    .add('TextCentered', () => (
      <Box style={{backgroundColor: 'red', width: 100}}>
        <Text type="Header" center={true}>
          This is centered
        </Text>
      </Box>
    ))
}

const outerStyle = isMobile
  ? {}
  : {display: 'grid', flex: 1, gridTemplateColumns: 'repeat(2, 1fr)', overflow: 'auto'}

export default load
