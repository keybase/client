// @flow
import * as React from 'react'
import {
  Box2,
  Button,
  Icon,
  ProgressIndicator,
  Text,
  WaitingButton,
  type IconType,
} from '../../../../common-adapters'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../../../../styles'
import {MarkdownMemo} from '../../../../wallets/common'

export type Props = {|
  action: string,
  approxWorth: string,
  amount: string,
  balanceChange: string,
  balanceChangeColor: string,
  cancelButtonInfo: string,
  cancelButtonLabel: string, // empty string if disabled
  canceled: boolean,
  claimButtonLabel: string, // empty string if disabled
  icon: ?IconType,
  loading: boolean,
  memo: string,
  onCancel: () => void,
  onClaim: () => void,
  onSend: () => void,
  pending: boolean,
  sendButtonLabel: string, // empty string if disabled
  showCoinsIcon: boolean,
|}

const ButtonText = (props: {text: string, amount: string}) => (
  <Text style={styles.buttonText} type="BodySemibold">
    {props.text}{' '}
    <Text style={styles.buttonText} type="BodyExtrabold">
      {props.amount}
    </Text>
  </Text>
)

const AccountPayment = (props: Props) => {
  const contents = props.loading ? (
    <Box2 direction="horizontal" gap="tiny" fullWidth={true} style={styles.alignItemsCenter}>
      <ProgressIndicator style={styles.progressIndicator} />
      <Text type="BodySmall">loading...</Text>
    </Box2>
  ) : (
    <React.Fragment>
      <Box2
        direction="horizontal"
        fullWidth={true}
        style={collapseStyles([
          styles.alignItemsCenter,
          styles.flexWrap,
          {marginBottom: globalMargins.xtiny},
        ])}
      >
        <Box2 direction="horizontal" gap="xtiny" gapEnd={true} style={styles.alignItemsCenter}>
          {!!props.icon && <Icon type={props.icon} color={globalColors.purple2} fontSize={12} />}
          <Text
            type="BodySmall"
            style={collapseStyles([styles.purple, props.canceled && styles.lineThrough])}
          >
            {props.action}{' '}
            <Text type="BodySmallExtrabold" selectable={true} style={styles.purple}>
              {props.amount}
            </Text>
            {props.approxWorth && (
              <Text type="BodySmall" style={styles.purple}>
                {' '}
                (approximately{' '}
                <Text type="BodySmallExtrabold" selectable={true} style={styles.purple}>
                  {props.approxWorth}
                </Text>
                )
              </Text>
            )}
            {props.pending ? '...' : '.'}
          </Text>
        </Box2>
        {props.canceled && <Text type="BodySmall">CANCELED</Text>}
        <Box2 direction="horizontal" style={styles.amountContainer} gap={isMobile ? 'tiny' : 'small'}>
          {!!props.balanceChange && (
            <Text type="BodyExtrabold" selectable={true} style={{color: props.balanceChangeColor}}>
              {props.balanceChange}
            </Text>
          )}
          {props.showCoinsIcon && <Icon type="icon-stellar-coins-stacked-16" />}
        </Box2>
      </Box2>
      <MarkdownMemo memo={props.memo} />
      {!!props.sendButtonLabel && (
        <Button type="Wallet" onClick={props.onSend} small={true} style={styles.button}>
          <ButtonText text={props.sendButtonLabel} amount={props.amount} />
        </Button>
      )}
      {!!props.claimButtonLabel && (
        <Button type="Wallet" onClick={props.onClaim} small={true} style={styles.button}>
          <ButtonText text={props.claimButtonLabel} amount={props.amount} />
        </Button>
      )}
      {!!props.cancelButtonLabel && (
        <Box2 direction="vertical" fullWidth={true} gap="xtiny">
          <Text type="BodySmall">{props.cancelButtonInfo}</Text>
          <WaitingButton
            waitingKey={null}
            type="Danger"
            label={props.cancelButtonLabel}
            onClick={props.onCancel}
            small={true}
            style={styles.button}
          />
        </Box2>
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
  alignItemsCenter: {
    alignItems: 'center',
  },
  amountContainer: {
    alignItems: 'center',
    marginLeft: 'auto',
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: globalMargins.xtiny,
  },
  buttonText: {
    color: globalColors.white,
  },
  flexWrap: {
    flexWrap: 'wrap',
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
  tooltipText: platformStyles({
    isElectron: {wordBreak: 'normal'},
  }),
})

export default AccountPayment
