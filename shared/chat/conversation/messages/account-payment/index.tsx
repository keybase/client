import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import {AllowedColors} from '../../../../common-adapters/text'
import * as Styles from '../../../../styles'
import {MarkdownMemo} from '../../../../wallets/common'

export type Props = {
  action: string
  approxWorth: string
  amount: string
  balanceChange: string
  balanceChangeColor?: AllowedColors
  cancelButtonInfo: string
  cancelButtonLabel: string
  canceled: boolean
  claimButtonLabel: string
  icon: Kb.IconType | null
  loading: boolean
  memo: string
  onCancel: () => void
  onClaim: () => void
  onSend: () => void
  pending: boolean
  sendButtonLabel: string
  showCoinsIcon: boolean
  sourceAmount?: string
}

const ButtonText = (props: {text: string; amount: string}) => (
  <Kb.Text style={styles.buttonText} type="BodySemibold">
    {props.text}{' '}
    <Kb.Text style={styles.buttonText} type="BodyExtrabold">
      {props.amount}
    </Kb.Text>
  </Kb.Text>
)

const AccountPayment = (props: Props) => {
  const balanceChange = (
    <Kb.Box2
      direction="horizontal"
      fullWidth={Styles.isMobile}
      style={styles.amountContainer}
      gap={Styles.isMobile ? 'tiny' : 'small'}
    >
      {!!props.balanceChange && (
        <Kb.Text type="BodyExtrabold" selectable={true} style={{color: props.balanceChangeColor}}>
          {props.balanceChange}
        </Kb.Text>
      )}
      {props.showCoinsIcon && <Kb.Icon type="icon-stellar-coins-stacked-16" />}
    </Kb.Box2>
  )
  const contents = props.loading ? (
    <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true} style={styles.alignItemsCenter}>
      <Kb.ProgressIndicator style={styles.progressIndicator} />
      <Kb.Text type="BodySmall">loading...</Kb.Text>
    </Kb.Box2>
  ) : (
    <>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        style={Styles.collapseStyles([
          styles.alignItemsCenter,
          styles.flexWrap,
          {marginBottom: Styles.globalMargins.xtiny},
        ])}
      >
        <Kb.Box2 direction="horizontal" gap="xtiny" gapEnd={true} style={styles.alignItemsCenter}>
          {!!props.icon && <Kb.Icon type={props.icon} color={Styles.globalColors.purple} fontSize={12} />}
          <Kb.Text
            type="BodySmall"
            style={Styles.collapseStyles([styles.purple, props.canceled && styles.lineThrough])}
          >
            {props.action}{' '}
            <Kb.Text type="BodySmallExtrabold" selectable={true} style={styles.purple}>
              {props.amount}
            </Kb.Text>
            {props.approxWorth && (
              <Kb.Text type="BodySmall" style={styles.purple}>
                {' '}
                (approximately{' '}
                <Kb.Text type="BodySmallExtrabold" selectable={true} style={styles.purple}>
                  {props.approxWorth}
                </Kb.Text>
                )
              </Kb.Text>
            )}
            {props.pending ? '...' : '.'}
          </Kb.Text>
        </Kb.Box2>
        {props.canceled && <Kb.Text type="BodySmall">CANCELED</Kb.Text>}
        {!Styles.isMobile && balanceChange}
      </Kb.Box2>
      <MarkdownMemo memo={props.memo} />
      {Styles.isMobile && balanceChange}
      {!!props.sendButtonLabel && (
        <Kb.Button type="Wallet" onClick={props.onSend} small={true} style={styles.button}>
          <ButtonText text={props.sendButtonLabel} amount={props.amount} />
        </Kb.Button>
      )}
      {!!props.claimButtonLabel && (
        <Kb.Button type="Wallet" onClick={props.onClaim} small={true} style={styles.button}>
          <ButtonText text={props.claimButtonLabel} amount={props.amount} />
        </Kb.Button>
      )}
      {!!props.cancelButtonLabel && (
        <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
          <Kb.Text type="BodySmall">{props.cancelButtonInfo}</Kb.Text>
          <Kb.WaitingButton
            waitingKey={null}
            type="Danger"
            label={props.cancelButtonLabel}
            onClick={props.onCancel}
            small={true}
            style={styles.button}
          />
        </Kb.Box2>
      )}
    </>
  )
  return (
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
      {contents}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  alignItemsCenter: {
    alignItems: 'center',
  },
  amountContainer: Styles.platformStyles({
    isElectron: {
      alignItems: 'center',
      marginLeft: 'auto',
    },
    isMobile: {
      justifyContent: 'space-between',
    },
  }),
  button: {
    alignSelf: 'flex-start',
    marginTop: Styles.globalMargins.xtiny,
  },
  buttonText: {
    color: Styles.globalColors.white,
  },
  flexWrap: {
    flexWrap: 'wrap',
  },
  lineThrough: {
    textDecorationLine: 'line-through',
  },
  progressIndicator: Styles.platformStyles({
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
  purple: {color: Styles.globalColors.purpleDark},
  tooltipText: Styles.platformStyles({
    isElectron: {wordBreak: 'normal'},
  }),
})

export default AccountPayment
