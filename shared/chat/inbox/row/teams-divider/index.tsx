import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RowSizes from '../sizes'

type Props = {
  badgeCount: number
  hiddenCount: number
  style: Styles.StylesCrossPlatform | null
  showButton: boolean
  loadMore?: () => void
}

const TeamsDivider = React.memo((props: Props) => (
  <Kb.Box2
    direction="vertical"
    style={Styles.collapseStyles([
      props.showButton ? styles.containerButton : styles.containerNoButton,
      props.style,
    ])}
    gap="tiny"
    gapStart={true}
    gapEnd={true}
  >
    {props.showButton && (
      <Kb.Button
        badgeNumber={props.badgeCount}
        label={`+${props.hiddenCount} more`}
        onClick={props.loadMore}
        small={true}
        style={styles.button}
        type="Dim"
      />
    )}
    {!props.showButton && (
      <Kb.Text type="BodySmallSemibold" style={styles.dividerText}>
        Big teams
      </Kb.Text>
    )}
  </Kb.Box2>
))

const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: {
        alignSelf: 'center',
        bottom: Styles.globalMargins.tiny,
        position: 'relative',
        width: undefined,
      },
      containerButton: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxColumn,
          flexShrink: 0,
          height: RowSizes.dividerHeight(true),
          justifyContent: 'center',
          width: '100%',
        },
        isElectron: {backgroundColor: Styles.globalColors.blueGrey},
        isMobile: {
          paddingBottom: Styles.globalMargins.tiny,
          paddingTop: Styles.globalMargins.tiny,
        },
      }),
      containerNoButton: {
        ...Styles.globalStyles.flexBoxColumn,
        flexShrink: 0,
        height: RowSizes.dividerHeight(false),
        justifyContent: 'center',
        width: '100%',
      },
      dividerText: {
        alignSelf: 'flex-start',
        marginLeft: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.tiny,
      },
    } as const)
)

export {TeamsDivider}
