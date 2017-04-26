// @flow
import React from 'react'
import {Confirm, Box, Text, Icon} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'

import type {Props} from '.'

const Header = ({name, icon}) => (
  <Box style={styleIcon}>
    <Icon type={icon} />
    <Text type='BodyBig' style={styleName}>{name}</Text>
  </Box>
)

const Body = ({endangeredTLFs, name, currentDevice}) => (
  <Box>
    <Box style={styleHeader}>
      <Text type='Header' style={styleText}>Are you sure you want to revoke {currentDevice ? 'your current device' : name}?</Text>
    </Box>

    {endangeredTLFs.length > 0 &&
      <Box>
        <Box>
          <Text type='Body' style={styleText}>You may lose access to these folders forever:</Text>
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

const Render = ({name, type, deviceID, currentDevice, onSubmit, onCancel, endangeredTLFs, icon}: Props) => (
  <Confirm
    body={<Body endangeredTLFs={endangeredTLFs} name={name} currentDevice={currentDevice} />}
    danger={true}
    header={<Header name={name} icon={icon} />}
    onCancel={onCancel}
    onSubmit={() => onSubmit({currentDevice, deviceID, name})}
    submitLabel='Yes, delete it'
    theme='public'
  />
)

const styleHeader = {
  marginBottom: globalMargins.tiny,
}

const styleTLF = {
  marginBottom: globalMargins.xtiny,
  marginTop: globalMargins.xtiny,
}

const styleText = {
  textAlign: 'center',
}

const styleIcon = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

const styleName = {
  color: globalColors.red,
  fontStyle: 'italic',
  marginTop: 4,
  textDecorationLine: 'line-through',
}

const styleDevicesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  alignSelf: 'center',
  marginBottom: globalMargins.small,
  padding: globalMargins.small,
}

export default Render
