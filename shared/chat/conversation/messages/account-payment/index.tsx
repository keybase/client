import * as Kb from '@/common-adapters'
import type {AllowedColors} from '@/common-adapters/text'
import MarkdownMemo from '@/wallets/markdown-memo'

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
      fullWidth={Kb.Styles.isMobile}
      style={styles.amountContainer}
      gap={Kb.Styles.isMobile ? 'tiny' : 'small'}
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
        style={Kb.Styles.collapseStyles([
          styles.alignItemsCenter,
          styles.flexWrap,
          {marginBottom: Kb.Styles.globalMargins.xtiny},
        ])}
      >
        <Kb.Box2 direction="horizontal" gap="xtiny" gapEnd={true} style={styles.alignItemsCenter}>
          {!!props.icon && (
            <Kb.Icon
              type={props.icon}
              color={props.pending ? Kb.Styles.globalColors.purpleOrWhite : Kb.Styles.globalColors.purple}
              fontSize={12}
            />
          )}
          <Kb.Text
            type="BodySmall"
            style={Kb.Styles.collapseStyles([
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
              style={Kb.Styles.collapseStyles([styles.purple, props.pending && styles.purpleOrWhite])}
            >
              {props.amount}
            </Kb.Text>
            {props.approxWorth && (
              <Kb.Text
                type="BodySmall"
                style={Kb.Styles.collapseStyles([styles.purple, props.pending && styles.purpleOrWhite])}
              >
                {' '}
                (approximately{' '}
                <Kb.Text
                  type="BodySmallExtrabold"
                  selectable={true}
                  style={Kb.Styles.collapseStyles([styles.purple, props.pending && styles.purpleOrWhite])}
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
        {!Kb.Styles.isMobile && balanceChange}
      </Kb.Box2>
      <MarkdownMemo memo={props.memo} style={styles.memo} />
      {Kb.Styles.isMobile && balanceChange}
    </>
  )
  return (
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true}>
      {contents}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      alignItemsCenter: {alignItems: 'center'},
      amountContainer: Kb.Styles.platformStyles({
        isElectron: {
          alignItems: 'center',
          marginLeft: 'auto',
        },
        isMobile: {justifyContent: 'space-between'},
      }),
      button: {
        alignSelf: 'flex-start',
        marginTop: Kb.Styles.globalMargins.xtiny,
      },
      buttonText: {color: Kb.Styles.globalColors.white},
      flexWrap: {flexWrap: 'wrap'},
      lineThrough: {textDecorationLine: 'line-through'},
      memo: Kb.Styles.platformStyles({
        isMobile: {paddingRight: Kb.Styles.globalMargins.small},
      }),
      progressIndicator: Kb.Styles.platformStyles({
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
      purple: {color: Kb.Styles.globalColors.purpleDark},
      purpleOrWhite: {color: Kb.Styles.globalColors.purpleDarkOrWhite},
      tooltipText: Kb.Styles.platformStyles({
        isElectron: {wordBreak: 'normal'},
      }),
    }) as const
)

export default AccountPayment
