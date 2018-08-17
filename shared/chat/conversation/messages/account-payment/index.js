// @flow
import * as React from 'react'
import {Box2, Button, Divider, Icon, Markdown, Text, type IconType} from '../../../../common-adapters'
import {globalColors, styleSheetCreate} from '../../../../styles'

export type Props = {
  action: string,
  amount: string,
  balanceChange: string,
  balanceChangeColor: string,
  icon: IconType,
  memo: string,
  onSend?: () => void,
  pending: boolean,
  sendButtonLabel?: string,
}

const AccountPayment = (props: Props) => {
  return (
    <Box2 direction="vertical" gap="xtiny" fullWidth={true}>
      <Box2 direction="horizontal" fullWidth={true} style={styles.headingContainer}>
        <Box2 direction="horizontal" gap="xtiny" style={styles.headingContainer}>
          <Icon type={props.icon} color={globalColors.purple2} fontSize={12} />
          <Text type="BodySmall" style={styles.purple}>
            {props.action}{' '}
            <Text type="BodySmallExtrabold" style={styles.purple}>
              {props.amount}
            </Text>
            {props.pending ? '...' : '.'}
          </Text>
        </Box2>
        {!!props.balanceChange && (
          <Box2 direction="horizontal">
            <Text type="BodyExtrabold" style={{color: props.balanceChangeColor}}>
              {props.balanceChange}
            </Text>
          </Box2>
        )}
      </Box2>
      <Box2 direction="horizontal" gap="small" fullWidth={true}>
        <Divider vertical={true} style={styles.quoteMarker} />
        <Markdown allowFontScaling={true}>{props.memo}</Markdown>
      </Box2>
      {!!props.sendButtonLabel &&
        !!props.onSend && (
          <Button
            type="Wallet"
            label={props.sendButtonLabel}
            onClick={props.onSend}
            style={{alignSelf: 'flex-start'}}
          />
        )}
    </Box2>
  )
}

const styles = styleSheetCreate({
  headingContainer: {
    alignItems: 'center',
    flex: 1,
  },
  purple: {color: globalColors.purple2},
  quoteMarker: {maxWidth: 3, minWidth: 3},
})

export default AccountPayment
