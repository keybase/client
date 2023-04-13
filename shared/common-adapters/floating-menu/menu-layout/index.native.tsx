import * as Styles from '../../../styles'
import {NativeTouchableOpacity} from '../../native-wrappers.native'
import Badge from '../../badge'
import Box, {Box2} from '../../box'
import Icon from '../../icon'
import Text from '../../text'
import Meta from '../../meta'
import Divider from '../../divider'
import ScrollView from '../../scroll-view'
import ProgressIndicator from '../../progress-indicator'
import SafeAreaView from '../../safe-area-view'
import type {MenuItem, MenuLayoutProps} from '.'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'

type MenuRowProps = {
  centered?: boolean
  isHeader?: boolean
  newTag?: boolean | null
  index: number
  numItems: number
  onHidden?: (() => void) | null
  textColor?: Styles.Color
  backgroundColor?: Styles.Color
} & MenuItem

const itemContainerHeight = 48
const itemContainerHeightWithSubTitle = itemContainerHeight + 18 // lineHeight of subTitle

const MenuRow = (props: MenuRowProps) => (
  <NativeTouchableOpacity
    disabled={props.disabled}
    onPress={() => {
      props.onHidden && !props.unWrapped && props.onHidden() // auto hide after a selection
      props.onClick && !props.unWrapped && props.onClick()
    }}
    style={Styles.collapseStyles([
      styles.itemContainer,
      !props.unWrapped && styles.itemContainerWrapped,
      !!props.subTitle && styles.itemContainerWithSubTitle,
      props.backgroundColor && {backgroundColor: props.backgroundColor},
    ])}
  >
    {props.view || (
      <Box2 centerChildren={props.centered} direction="horizontal" fullWidth={true}>
        <Box2 direction="horizontal" style={styles.flexOne}>
          <Box2 direction="vertical" fullHeight={true}>
            <Box2 direction="horizontal" fullWidth={true}>
              {props.decoration && <Box style={styles.flexOne} />}
              <Text type="Body" style={styleRowText(props)}>
                {props.title}
              </Text>
              {props.newTag && (
                <Meta
                  title="New"
                  size="Small"
                  backgroundColor={Styles.globalColors.blue}
                  style={styles.badge}
                />
              )}
              {props.decoration && <Box style={styles.flexOne}>{props.decoration}</Box>}
            </Box2>
            {!!props.subTitle && (
              <Box2 direction="horizontal" fullWidth={true}>
                <Text type="BodySmall">{props.subTitle}</Text>
              </Box2>
            )}
          </Box2>
        </Box2>
        <Box2
          direction="horizontal"
          fullHeight={true}
          style={Styles.collapseStyles([!props.centered && styles.iconContainer])}
        >
          {props.isSelected && (
            <Icon type="iconfont-check" color={Styles.globalColors.blue} fontSize={16} sizeType="Default" />
          )}
          {props.icon &&
            !props.isSelected &&
            (props.inProgress ? (
              <ProgressIndicator />
            ) : (
              <>
                <Icon
                  color={props.danger ? Styles.globalColors.redDark : Styles.globalColors.black_60}
                  style={props.iconStyle}
                  sizeType="Default"
                  type={props.icon}
                />
                {props.isBadged && <Badge badgeStyle={styles.iconBadge} />}
              </>
            ))}
        </Box2>
      </Box2>
    )}
    {!!props.progressIndicator && <ProgressIndicator style={styles.progressIndicator} />}
  </NativeTouchableOpacity>
)

const MenuLayout = (props: MenuLayoutProps) => {
  const menuItemsWithDividers = props.items.filter((x): x is MenuItem | 'Divider' => x !== null)
  const beginningDivider = props.items[0] === 'Divider'
  const firstIsUnWrapped = props.items[0] !== 'Divider' && props.items[0]?.unWrapped

  return (
    <SafeAreaProvider
      initialMetrics={initialWindowMetrics}
      style={[styles.safeProvider, props.safeProviderStyle]}
    >
      <SafeAreaView
        style={Styles.collapseStyles([
          styles.safeArea,
          props.backgroundColor && {backgroundColor: props.backgroundColor},
        ])}
      >
        <Box
          style={Styles.collapseStyles([
            styles.menuBox,
            firstIsUnWrapped && styles.firstIsUnWrapped,
            props.backgroundColor && {backgroundColor: props.backgroundColor},
          ])}
        >
          {/* Display header if there is one */}
          {props.header}
          {beginningDivider && <Divider />}
          <ScrollView
            alwaysBounceVertical={false}
            style={Styles.collapseStyles([styles.scrollView, firstIsUnWrapped && styles.firstIsUnWrapped])}
            contentContainerStyle={styles.menuGroup}
          >
            {menuItemsWithDividers.map((mi, idx) =>
              mi === 'Divider' ? (
                idx !== 0 && idx !== props.items.length ? (
                  <Divider key={idx} style={styles.dividerInScrolleView} />
                ) : null
              ) : (
                <MenuRow
                  key={idx}
                  {...mi}
                  index={idx}
                  numItems={menuItemsWithDividers.length}
                  onHidden={props.closeOnClick ? props.onHidden : undefined}
                  textColor={props.textColor}
                  backgroundColor={props.backgroundColor}
                />
              )
            )}
          </ScrollView>
          <Divider style={styles.divider} />
          <Box style={Styles.collapseStyles([styles.menuGroup, props.listStyle])}>
            <MenuRow
              centered={true}
              title={props.closeText || 'Close'}
              index={0}
              numItems={1}
              onClick={props.onHidden} // pass in nothing to onHidden so it doesn't trigger it twice
              onHidden={() => {}}
              textColor={props.textColor}
              backgroundColor={props.backgroundColor}
            />
          </Box>
        </Box>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styleRowText = (props: {
  isHeader?: boolean
  danger?: boolean
  disabled?: boolean
  textColor?: Styles.Color
}) => {
  const dangerColor = props.danger ? Styles.globalColors.redDark : Styles.globalColors.black
  const color = props.textColor || props.isHeader ? Styles.globalColors.white : dangerColor
  return {color, ...(props.disabled ? {opacity: 0.6} : {})}
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        alignSelf: 'center',
        marginLeft: Styles.globalMargins.tiny,
      },
      divider: {
        marginBottom: Styles.globalMargins.tiny,
      },
      dividerInScrolleView: {
        marginBottom: Styles.globalMargins.tiny,
        marginTop: Styles.globalMargins.tiny,
      },
      firstIsUnWrapped: {paddingTop: 0},
      flexOne: {
        flex: 1,
      },
      iconBadge: {
        backgroundColor: Styles.globalColors.blue,
        height: Styles.globalMargins.tiny,
        minWidth: 0,
        paddingLeft: 0,
        paddingRight: 0,
        position: 'relative',
        right: Styles.globalMargins.xtiny,
        width: Styles.globalMargins.tiny,
      },
      iconContainer: {
        width: 20,
      },
      itemContainer: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.white,
        height: itemContainerHeight,
        justifyContent: 'center',
        position: 'relative',
      },
      itemContainerWithSubTitle: {
        height: itemContainerHeightWithSubTitle,
      },
      itemContainerWrapped: {
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.medium,
        paddingRight: Styles.globalMargins.medium,
        paddingTop: Styles.globalMargins.tiny,
      },
      menuBox: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'stretch',
        backgroundColor: Styles.globalColors.white,
        justifyContent: 'flex-end',
        paddingBottom: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.xsmall,
      },
      menuGroup: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'stretch',
        justifyContent: 'flex-end',
      },
      progressIndicator: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      safeArea: {
        backgroundColor: Styles.globalColors.white,
      },
      safeProvider: {
        flex: 0,
        justifyContent: 'flex-end',
      },
      scrollView: {
        flexGrow: 1,
        marginBottom: Styles.globalMargins.tiny,
        marginTop: Styles.globalMargins.tiny,
      },
    } as const)
)

export default MenuLayout
