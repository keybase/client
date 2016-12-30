// @flow
import React from 'react'
import type {IconType} from '../../common-adapters/icon'
import type {Props} from './index.render'
import {Confirm, Box, Text, Icon} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'

const Render = ({name, type, deviceID, currentDevice, onSubmit, onCancel, endangeredTLFs}: Props) => {
  const icon: IconType = {
    'mobile': 'icon-phone-revoke-48',
    'desktop': 'icon-computer-revoke-48',
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
            <Text type='Body'>You may lose access to these folders forever:</Text>
          </Box>

          <Box style={styleDevicesContainer}>
            {endangeredTLFs.map(tlf => (
              <Box key={tlf.name} style={styleTLF}>
                <Text type='BodySemibold' style={{marginRight: globalMargins.tiny}}>•</Text>
                <Text type='BodySemibold'>{tlf.name}</Text>
              </Box>
            ))}
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
  marginBottom: globalMargins.xtiny,
}

const styleName = {
  textDecoration: 'line-through',
  color: globalColors.red,
  fontStyle: 'italic',
  marginTop: 4,
}

const styleDevicesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  height: 162,
  width: 440,
  overflowY: 'scroll',
  border: '1px solid '+ globalColors.black_05,
  borderRadius: 4,
  alignSelf: 'center',
  marginTop: globalMargins.small,
  marginBottom: globalMargins.small,
  padding: globalMargins.small,
}

export default Render
