// @flow
import * as React from 'react'
import {Box2, Button, Icon, ProgressIndicator, Text, type IconType} from '../../../../common-adapters'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  platformStyles,
  styleSheetCreate,
} from '../../../../styles'
import {MarkdownMemo} from '../../../../wallets/common'

export type Props = {|
  action: string,
  amount: string,
  balanceChange: string,
  balanceChangeColor: string,
  canceled: boolean,
  icon: IconType,
  loading: boolean,
  memo: string,
  onSend: () => void,
  pending: boolean,
  sendButtonLabel: string,
|}

const AccountPayment = (props: Props) => {
  const contents = props.loading ? (
    <Box2 direction="horizontal" gap="tiny" fullWidth={true} style={styles.headingContainer}>
      <ProgressIndicator style={styles.progressIndicator} />
      <Text type="BodySmall">loading...</Text>
    </Box2>
  ) : (
    <React.Fragment>
      <Box2 direction="horizontal" fullWidth={true} style={styles.headingContainer}>
        <Box2
          direction="horizontal"
          gap="xtiny"
          style={collapseStyles([styles.headingContainer, {marginBottom: globalMargins.xtiny}])}
        >
          <Icon type={props.icon} color={globalColors.purple2} fontSize={12} />
          <Text
            type="BodySmall"
            style={collapseStyles([styles.purple, props.canceled && styles.lineThrough])}
          >
            {props.action}{' '}
            <Text type="BodySmallExtrabold" selectable={true} style={styles.purple}>
              {props.amount}
            </Text>
            {props.pending ? '...' : '.'}
          </Text>
          {props.canceled && <Text type="BodySmall">CANCELED</Text>}
        </Box2>
        {!!props.balanceChange && (
          <Box2 direction="horizontal">
            <Text
              type="BodyExtrabold"
              selectable={true}
              style={collapseStyles([
                {color: props.balanceChangeColor},
                props.canceled && styles.lineThrough,
              ])}
            >
              {props.balanceChange}
            </Text>
          </Box2>
        )}
      </Box2>
      <MarkdownMemo memo={props.memo} />
      {!!props.sendButtonLabel &&
        !!props.onSend && (
          <Button
            type="Wallet"
            label={props.sendButtonLabel}
            onClick={props.onSend}
            small={true}
            style={{alignSelf: 'flex-start'}}
          />
        )}
    </React.Fragment>
  )
  return (
    <Box2 direction="vertical" gap="xtiny" fullWidth={true}>
      {contents}
    </Box2>
  )
}

const styles = styleSheetCreate({
  headingContainer: {
    alignItems: 'center',
    flex: 1,
  },
  lineThrough: {
    textDecorationLine: 'line-through',
  },
  progressIndicator: platformStyles({
    // Match height of a line of text
    isElectron: {
      height: 17,
      width: 17,
    },
    isMobile: {
      height: 22,
      width: 22,
    },
  }),
  purple: {color: globalColors.purple2},
})

export default AccountPayment
