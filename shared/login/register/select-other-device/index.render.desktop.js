// @flow
import React from 'react'
import {Text, Icon} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles/style-guide'
import Container from '../../forms/container.desktop'
import type {Props} from './index.render'

const Row = ({deviceID, name, type, onSelect}) => {
  const iconType = {
    'mobile': 'phone-big',
    'computer': 'computer-big',
    'paper key': 'paper-key-m'
  }[type]

  const onClick = e => {
    onSelect(deviceID)
    e && e.preventDefault()
  }

  return (
    <div style={styles.row} onClick={onClick}>
      <div style={styles.iconName}>
        <div style={styles.iconContainer}>
          <Icon style={styles.icon} type={iconType}/>
        </div>
        <Text type='BodySemiboldItalic' onClick={onClick}>{name}</Text>
      </div>
    </div>)
}

const Render = ({onBack, devices, onWont, onSelect}: Props) => (
  <Container
    style={styles.container}
    onBack={onBack}>
    <Text type='Header' style={styles.header}>Which device would you like to connect with?</Text>
    <div style={styles.devicesContainer}>
      {devices.map(d => <Row onSelect={onSelect} {...d} key={d.deviceID}/>)}
    </div>
    <Text style={styles.wont} type='BodySecondaryLink' onClick={onWont}>Log in with your passphrase</Text>
  </Container>
)

const styles = {
  container: {},
  header: {
    alignSelf: 'center',
    marginTop: 46,
    marginBottom: 20
  },
  devicesContainer: {
    ...globalStyles.flexBoxColumn,
    flex: 1,
    overflow: 'auto',
    width: 375,
    alignSelf: 'center'
  },
  row: {
    ...globalStyles.flexBoxColumn,
    ...globalStyles.clickable,
    justifyContent: 'center',
    minHeight: 80,
    padding: 10,
    borderBottom: `solid ${globalColors.black10} 1px`
  },
  iconName: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center'
  },
  iconContainer: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'center',
    alignItems: 'center'
  },
  icon: {
    color: globalColors.black,
    marginLeft: 32,
    marginRight: 22,
    maxHeight: 60
  },
  wont: {
    marginTop: 10,
    alignSelf: 'flex-end'
  }
}

export default Render
