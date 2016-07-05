// @flow

import React from 'react'
import {globalStyles} from '../styles/style-guide'
import {Text, Button, Icon} from '../common-adapters'

const PaperKeyInput = ({onClose}: {onClose: () => void}) => (
  <div style={containerStyle}>
    <Icon type='icon-folders-private-success-48' />
    <Text style={successStyle} type='Body'>Success!</Text>
    <Text style={{textAlign: 'center', paddingLeft: 60, paddingRight: 60}} type='Body'>We're unlocking some folders on this computer. Check back in a bit.</Text>
    <Button type='Primary' label='Okay' style={finishStyle} onClick={onClose} />
  </div>
)

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  position: 'absolute',
  top: 72,
  left: 0,
  right: 0,
  bottom: 30,
  justifyContent: 'space-between',
}

const successStyle = {
  textAlign: 'center',
}

const finishStyle = {
  marginRight: 30,
  alignSelf: 'flex-end',
}

export default PaperKeyInput
