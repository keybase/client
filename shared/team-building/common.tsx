import * as Kb from '@/common-adapters'

type SearchEmptyStateProps = {
  icon: Kb.IconType
  text: string
}

// Shown by the email/phone search screens when there is no matching user yet.
export const SearchEmptyState = ({icon, text}: SearchEmptyStateProps) => (
  <Kb.Box2
    alignSelf="center"
    centerChildren={!isMobile}
    direction="vertical"
    fullWidth={true}
    gap="tiny"
    style={styles.emptyContainer}
  >
    {!isMobile && <Kb.Icon color={Kb.Styles.globalColors.black_20} fontSize={48} type={icon} />}
    <Kb.Text type="BodySmall" style={styles.helperText}>
      {text}
    </Kb.Text>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      emptyContainer: Kb.Styles.platformStyles({
        common: {flex: 1},
        isElectron: {
          maxWidth: 290,
          paddingBottom: 40,
        },
        isMobile: {maxWidth: '90%'},
      }),
      helperText: Kb.Styles.platformStyles({
        common: {textAlign: 'center'},
        isMobile: {
          ...Kb.Styles.paddingV(Kb.Styles.globalMargins.small),
        },
      }),
    }) as const
)
