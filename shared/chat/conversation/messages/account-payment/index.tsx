import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type {AllowedColors} from '../../../../common-adapters/text'
import MarkdownMemo from '../../../../wallets/markdown-memo'

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
  icon?: Kb.IconType
  loading: boolean
  memo: string
  pending: boolean
  sendButtonLabel: string
  showCoinsIcon: boolean
  sourceAmount?: string
}

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
          {!!props.icon && (
            <Kb.Icon
              type={props.icon}
              color={props.pending ? Styles.globalColors.purpleOrWhite : Styles.globalColors.purple}
              fontSize={12}
            />
          )}
          <Kb.Text
            type="BodySmall"
            style={Styles.collapseStyles([
              {flexShrink: 1},
              styles.purple,
              props.pending && styles.purpleOrWhite,
              props.canceled && styles.lineThrough,
            ])}
          >
            {props.action}{' '}
            <Kb.Text
              type="BodySmallExtrabold"
              selectable={true}
              style={Styles.collapseStyles([styles.purple, props.pending && styles.purpleOrWhite])}
            >
              {props.amount}
            </Kb.Text>
            {props.approxWorth && (
              <Kb.Text
                type="BodySmall"
                style={Styles.collapseStyles([styles.purple, props.pending && styles.purpleOrWhite])}
              >
                {' '}
                (approximately{' '}
                <Kb.Text
                  type="BodySmallExtrabold"
                  selectable={true}
                  style={Styles.collapseStyles([styles.purple, props.pending && styles.purpleOrWhite])}
                >
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
      <MarkdownMemo memo={props.memo} style={styles.memo} />
      {Styles.isMobile && balanceChange}
    </>
  )
  return (
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
      {contents}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      alignItemsCenter: {alignItems: 'center'},
      amountContainer: Styles.platformStyles({
        isElectron: {
          alignItems: 'center',
          marginLeft: 'auto',
        },
        isMobile: {justifyContent: 'space-between'},
      }),
      button: {
        alignSelf: 'flex-start',
        marginTop: Styles.globalMargins.xtiny,
      },
      buttonText: {color: Styles.globalColors.white},
      flexWrap: {flexWrap: 'wrap'},
      lineThrough: {textDecorationLine: 'line-through'},
      memo: Styles.platformStyles({
        isMobile: {paddingRight: Styles.globalMargins.small},
      }),
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
      purpleOrWhite: {color: Styles.globalColors.purpleDarkOrWhite},
      tooltipText: Styles.platformStyles({
        isElectron: {wordBreak: 'normal'},
      }),
    }) as const
)

export default AccountPayment
