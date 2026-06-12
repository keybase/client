import * as Kb from '@/common-adapters'

type SearchEmptyStateProps = {
  icon: Kb.IconType
  text: string
}

// Shown by the email/phone search screens when there is no matching user yet.
// Quirks vs plain Kb.EmptyState: icon only on desktop, top-aligned on mobile,
// and BodySmall text with mobile padding.
export const SearchEmptyState = ({icon, text}: SearchEmptyStateProps) => (
  <Kb.EmptyState
    centerChildren={!isMobile}
    gap="tiny"
    icon={isMobile ? undefined : icon}
    style={styles.emptyContainer}
  >
    <Kb.Text type="BodySmall" style={styles.helperText}>
      {text}
    </Kb.Text>
  </Kb.EmptyState>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      emptyContainer: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'center',
          flex: 1,
        },
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
