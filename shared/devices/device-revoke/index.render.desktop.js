// @flow
import React from 'react'
import type {IconType} from '../../common-adapters/icon'
import type {Props} from './index.render'
import {Confirm, Box, Text, Icon} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'

const Render = ({name, type, deviceID, currentDevice, onSubmit, onCancel, endangeredTLFs}: Props) => {
  console.warn('tlfs')
  console.warn(endangeredTLFs)
  const icon: IconType = {
    'mobile': 'icon-phone-bw-revoke-48',
    'desktop': 'icon-computer-bw-revoke-48',
    'backup': 'icon-paper-key-revoke-48',
  }[type]

  const header = (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
      <Icon type={icon} />
      <Text type='BodySemibold' style={stylesName}>{name}</Text>
    </Box>
  )

  const body = (
    <Box>
      <Box style={stylesHeader}>
        <Text type='BodySemibold'>Are you sure you want to revoke </Text>{currentDevice ? <Text type='BodySemibold'>your current device</Text> : <Text type='BodySemiboldItalic'>{name}</Text>}?
      </Box>

      {endangeredTLFs.length > 0 &&
        <Box>
          <Box>
            <Text type='BodySmallSemibold'>You may lose access to these folders forever:</Text>
          </Box>

          <Box style={stylesDevicesContainer}>
            <ul>
              {endangeredTLFs.map(tlf => (
                <Box key={tlf.name} style={stylesTLF}>
                  <li>
                    <Text type='BodySemibold'>{tlf.name}</Text>
                  </li>
                </Box>
              ))}
            </ul>
          </Box>
        </Box>
      }
    </Box>
  )

  return (
    <Confirm theme='public' danger={true} header={header} body={body} submitLabel='Yes, delete it' onSubmit={() => onSubmit({deviceID, name, currentDevice})} onCancel={onCancel} />
  )
}

const stylesHeader = {
  marginBottom: globalMargins.tiny,

}
const stylesTLF = {
  marginTop: globalMargins.tiny,
  marginBottom: globalMargins.small,
}

const stylesName = {
  textDecoration: 'line-through',
  color: globalColors.red,
  fontStyle: 'italic',
  marginTop: 4,
}

const stylesDevicesContainer = {
  height: 162,
  width: 440,
  overflowY: 'scroll',
  backgroundColor: globalColors.lightGrey,
  alignSelf: 'center',
  marginTop: 15,
  marginBottom: 15,
  paddingTop: 15,
  paddingBottom: 15,
}

export default Render
