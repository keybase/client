// @flow
import React from 'react'
import type {IconType} from '../../common-adapters/icon'
import type {Props} from './index.render'
import {Confirm, Box, Text, Icon} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'

const Render = ({name, type, deviceID, currentDevice, onSubmit, onCancel, endangeredTLFs}: Props) => {
  const icon: IconType = {
    'mobile': 'icon-phone-bw-revoke-64',
    'desktop': 'icon-computer-bw-revoke-64',
    'backup': 'icon-paper-key-revoke-64',
  }[type]

  const header = (
    <Box style={styleIcon}>
      <Icon type={icon} />
      <Text type='BodyBig' style={styleName}>{name}</Text>
    </Box>
  )

  const body = (
    <Box>
      <Box style={styleHeader}>
        <Text type='BodySemibold' style={styleText}>Are you sure you want to revoke {currentDevice ? 'your current device' : name}?</Text>
      </Box>

      {endangeredTLFs.length > 0 &&
        <Box>
          <Box>
            <Text type='BodySmallSemibold' style={styleText}>You may lose access to these folders forever:</Text>
          </Box>

          <Box style={styleDevicesContainer}>
            {endangeredTLFs.map(tlf => (
              <Box key={tlf.name} style={styleTLF}>
                <Text type='BodySemibold' style={styleText}>• {tlf.name}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      }
    </Box>
  )

  return <Confirm theme='public' danger={true} header={header} body={body} submitLabel='Yes, delete it' onSubmit={() => onSubmit({deviceID, name, currentDevice})} onCancel={onCancel} />
}

const styleHeader = {
  marginBottom: globalMargins.tiny,
}

const styleTLF = {
  marginTop: globalMargins.tiny,
  marginBottom: globalMargins.small,
}

const styleText = {
  textAlign: 'center',
}

const styleIcon = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

const styleName = {
  textDecorationLine: 'line-through',
  color: globalColors.red,
  fontStyle: 'italic',
  marginTop: 4,
}

const styleDevicesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  height: 200,
  width: 300,
  backgroundColor: globalColors.lightGrey,
  alignSelf: 'center',
  marginTop: globalMargins.small,
  marginBottom: globalMargins.small,
  padding: globalMargins.small,
}

export default Render
