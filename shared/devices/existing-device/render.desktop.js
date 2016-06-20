// @flow
import React from 'react'
import {Box, Text, Icon} from '../../common-adapters'
import {globalStyles, globalColors, transition} from '../../styles/style-guide'
import Container from '../../login/forms/container'
import type {Props} from './render'

const Item = ({onClick, icon, title}) => {
  return (
    <Box className='existing-device-container' style={stylesItem} onClick={onClick}>
      <Box className='existing-device-item' style={stylesIconContainer}>
        <Icon type={icon} style={stylesIcon} inheritColor />
      </Box>
      <Text link type='Header'>{title}</Text>
    </Box>
  )
}

const Render = ({onBack, onSubmitComputer, onSubmitPhone}: Props) => {
  const realCSS = `
  .existing-device-container .existing-device-item {
    background-color: ${globalColors.lightGrey};
    color: ${globalColors.black_75};
  }
  .existing-device-container:hover .existing-device-item {
    background-color: ${globalColors.blue4};
    color: ${globalColors.black};
  }
  `

  return (
    <Container
      style={stylesContainer}
      onBack={() => onBack()}>
      <style>{realCSS}</style>
      <Text type='Header' style={stylesHeader}>What’s your other device?</Text>
      <Box style={stylesItemContainer}>
        <Item title='Phone' icon='icon-phone-colors-64' onClick={onSubmitPhone} />
        <Item title='Computer' icon='icon-computer-colors-64' onClick={onSubmitComputer} />
      </Box>
    </Container>
  )
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  padding: 60,
  alignItems: 'center',
}

const stylesHeader = {
  marginTop: 60,
  marginBottom: 77,
}
const stylesItemContainer = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
}
const stylesItem = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.clickable,
  alignItems: 'center',
  margin: 15,
  width: 150,
}
const stylesIconContainer = {
  ...globalStyles.flexBoxColumn,
  ...transition('color', 'background-color'),
  alignItems: 'center',
  borderRadius: 150 / 2,
  height: 150,
  justifyContent: 'center',
  marginBottom: 15,
  width: 150,
}
const stylesIcon = {
  textAlign: 'center',
}

export default Render
