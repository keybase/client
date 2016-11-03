// @flow
import React from 'react'
import type {IconType} from '../../common-adapters/icon'
import type {Props} from './index.render'
import {Confirm, Box, Text, Icon} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'

const Render = ({name, type, deviceID, currentDevice, onSubmit, onCancel, endangeredTLFs}: Props) => {
  const icon: IconType = {
    'mobile': 'icon-phone-bw-revoke-48',
    'desktop': 'icon-computer-bw-revoke-48',
    'backup': 'icon-paper-key-revoke-48',
  }[type]

  const header = (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
      <Icon type={icon} />
      <Text type='BodySemibold' style={styleName}>{name}</Text>
    </Box>
  )

  const body = (
    <Box>
      <Box style={styleHeader}>
        <Text type='BodySemibold'>Are you sure you want to revoke </Text>{currentDevice ? <Text type='BodySemibold'>your current device</Text> : <Text type='BodySemiboldItalic'>{name}</Text>}<Text type='BodySemibold'>?</Text>
      </Box>

      {endangeredTLFs.length > 0 &&
        <Box>
          <Box>
            <Text type='BodySmallSemibold'>You may lose access to these folders forever:</Text>
          </Box>

          <Box style={styleDevicesContainer}>
            <ul>
              {endangeredTLFs.map(tlf => (
                <Box key={tlf.name} style={styleTLF}>
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

const styleHeader = {
  marginBottom: globalMargins.tiny,
}

const styleTLF = {
  marginTop: globalMargins.tiny,
  marginBottom: globalMargins.small,
}

const styleName = {
  textDecoration: 'line-through',
  color: globalColors.red,
  fontStyle: 'italic',
  marginTop: 4,
}

const styleDevicesContainer = {
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
