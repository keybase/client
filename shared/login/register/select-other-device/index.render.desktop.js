// @flow
import React from 'react'
import {Text, Icon} from '../../../common-adapters'
import {globalStyles, globalColors} from '../../../styles/style-guide'
import Container from '../../forms/container.desktop'
import type {Props} from './index.render'

const Row = ({deviceID, name, type, onSelect}) => {
  const iconType = {
    'mobile': 'fa-mobile',
    'computer': 'fa-laptop',
    'paper key': 'paper-key'
  }[type]

  const onClick = e => {
    onSelect(deviceID)
    e && e.preventDefault()
  }

  return (
    <div style={styles.row} onClick={onClick}>
      <div style={styles.iconContainer}>
        <Icon style={styles.icon} type={iconType}/>
      </div>
      <Text type='Body' onClick={onClick}>{name}</Text>
    </div>)
}

const Render = ({onBack, devices, onWont, onSelect}: Props) => (
  <Container
    style={styles.container}
    onBack={onBack}>
    <Text type='Header' style={styles.header}>Select a device to connect with:</Text>
    <div style={styles.devicesContainer}>
      {devices.map(d => <Row onSelect={onSelect} {...d} key={d.deviceID}/>)}
    </div>
    <Text style={styles.wont} type='BodySecondaryLink' onClick={onWont}>I don't have one of these devices</Text>
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
    overflow: 'auto'
  },
  row: {
    ...globalStyles.flexBoxRow,
    ...globalStyles.clickable,
    minHeight: 50,
    padding: 10,
    alignItems: 'center'
  },
  iconContainer: {
    ...globalStyles.flexBoxRow,
    width: 50,
    justifyContent: 'center',
    alignItems: 'center'
  },
  icon: {
    color: globalColors.black,
    fontSize: 40
  },
  wont: {
    marginTop: 10,
    alignSelf: 'flex-end'
  }
}

export default Render
