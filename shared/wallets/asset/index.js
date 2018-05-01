// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import {Box2, Icon, Text} from '../../common-adapters'
import {globalMargins} from '../../styles'

export type NativeAssetProps = {
  availableToSend: string,
  balance: string,
  displayBalance: string, // e.g. '$123.45 USD'
  expanded: boolean,
  reserves: Types.Reserve[],
  toggleExpanded: () => void,
}

export const NativeAsset = (props: NativeAssetProps) => {
  const caratType = props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'
  return (
    <Box2 direction="horizontal" fullWidth={true} style={containerStyle}>
      <Box2 direction="horizontal" gap="tiny" style={labelContainerStyle}>
        <Icon type={caratType} />
        {/* TODO (DA) align with 'Lumens' */}
        <Box2 direction="vertical">
          <Text type="BodySemibold">Lumens</Text>
          <Text type="BodySmall">Stellar Network</Text>
        </Box2>
      </Box2>
      <Box2 direction="vertical" style={balanceContainerStyle}>
        <Text type="BodySemibold" style={{color: '#814cf4', fontWeight: '800'}}>
          {props.balance}
        </Text>
        <Text type="BodySmall">{props.displayBalance}</Text>
      </Box2>
    </Box2>
  )
}

const containerStyle = {
  padding: globalMargins.tiny,
  paddingRight: globalMargins.small,
}

const labelContainerStyle = {
  flex: 1,
}

const balanceContainerStyle = {
  alignItems: 'flex-end',
}
