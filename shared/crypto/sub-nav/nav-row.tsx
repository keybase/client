import * as Kb from '@/common-adapters'
import type {IconType} from '@/common-adapters/icon.constants-gen'

type Props = {
  title: string
  tab: string
  // Desktop only
  icon?: IconType
  isSelected?: boolean
  // Mobile only
  description?: string
  illustration?: IconType
  onClick: () => void
}

const NavRow = (props: Props) => {
  const {isSelected, title, icon, illustration, description, onClick} = props

  const desktopRow = icon ? (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      testID={`crypto-nav-${props.tab}`}
      className={Kb.Styles.classNames({
        background_color_blue: isSelected,
        hover_background_color_blueGreyDark: !isSelected,
      })}
    >
      <Kb.ListItem
        type="Small"
        firstItem={true}
        statusIcon={
          <Kb.IconAuto
            type={icon}
            sizeType="Small"
            color={isSelected ? Kb.Styles.globalColors.whiteOrWhite : undefined}
            padding="xtiny"
          />
        }
        onClick={onClick}
        hideHover={true}
        body={
          <Kb.Box2
            direction="vertical"
            fullHeight={true}
            fullWidth={true}
            justifyContent="center"
            style={styles.desktopItemBody}
          >
            <Kb.Text
              type="BodySemibold"
              style={{
                color: isSelected ? Kb.Styles.globalColors.whiteOrWhite : Kb.Styles.globalColors.blackOrWhite,
              }}
            >
              {title}
            </Kb.Text>
          </Kb.Box2>
        }
      />
    </Kb.Box2>
  ) : null

  const mobileRow =
    description && illustration ? (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        // collapsable={false}: keep this testID'd row in the Android native view
        // tree — RN flattens the wrapper away otherwise, so the e2e crypto-nav-*
        // testID vanishes and the row can't be located/tapped.
        collapsable={false}
        testID={`crypto-nav-${props.tab}`}
      >
        <Kb.ListItem
          type="Card"
          firstItem={true}
          icon={<Kb.IconAuto type={illustration} />}
          body={
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <Kb.Text type="BodySemibold">{title}</Kb.Text>
              <Kb.Text type="BodySmall">{description}</Kb.Text>
            </Kb.Box2>
          }
          onClick={onClick}
        />
      </Kb.Box2>
    ) : null

  return isMobile ? mobileRow : desktopRow
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  desktopItemBody: {
    marginLeft: Kb.Styles.globalMargins.tiny,
  },
}))

export default NavRow
