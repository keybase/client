// @flow
import * as React from 'react'
import {Confirm, Box, Text, Icon, ProgressIndicator, type IconType} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'

export type Props = {
  currentDevice: boolean,
  deviceID: string,
  endangeredTLFs: Array<string>,
  icon: IconType,
  name: string,
  onCancel: () => void,
  onSubmit: () => void,
  waiting: boolean,
}

const Header = ({name, icon}: {name: string, icon: IconType}) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
    <Icon type={icon} />
    <Text type="BodySemibold" style={styleName}>
      {name}
    </Text>
  </Box>
)

const Body = ({
  endangeredTLFs,
  name,
  currentDevice,
  waiting,
}: {
  endangeredTLFs: Array<string>,
  name: string,
  currentDevice: boolean,
  waiting: boolean,
}) => (
  <Box>
    <Box style={styleHeader}>
      <Text type="BodySemibold">Are you sure you want to revoke </Text>
      {currentDevice ? (
        <Text type="BodySemibold">your current device</Text>
      ) : (
        <Text type="BodySemiboldItalic">{name}</Text>
      )}
      <Text type="BodySemibold">?</Text>
    </Box>

    {waiting ? (
      <ProgressIndicator />
    ) : (
      endangeredTLFs.length > 0 && (
        <Box>
          <Box>
            <Text type="Body">You may lose access to these folders forever:</Text>
          </Box>

          <Box style={styleDevicesContainer}>
            {endangeredTLFs.map(tlf => (
              <Box key={tlf} style={styleTLF}>
                <Text type="BodySemibold" style={{marginRight: globalMargins.tiny}}>
                  •
                </Text>
                <Text type="BodySemibold" selectable={true}>
                  {tlf}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )
    )}
  </Box>
)

const DeviceRevoke = (props: Props) => (
  <Confirm
    body={
      <Body
        endangeredTLFs={props.endangeredTLFs}
        name={props.name}
        currentDevice={props.currentDevice}
        waiting={props.waiting}
      />
    }
    danger={true}
    header={<Header name={props.name} icon={props.icon} />}
    onCancel={props.onCancel}
    onSubmit={props.waiting ? null : props.onSubmit}
    disabled={!!props.waiting}
    submitLabel="Yes, delete it"
    theme="public"
  />
)

const styleHeader = {
  marginBottom: globalMargins.tiny,
}

const styleTLF = {
  marginBottom: globalMargins.xtiny,
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
  border: '1px solid ' + globalColors.black_05,
  borderRadius: 4,
  height: 162,
  marginBottom: globalMargins.small,
  marginTop: globalMargins.small,
  overflowY: 'scroll',
  padding: globalMargins.small,
  width: 440,
}

export default DeviceRevoke
