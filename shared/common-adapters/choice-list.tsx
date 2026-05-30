import {Box2, ClickableBox3} from './box'
import IconAuto from './icon-auto'
import Text from './text'
import * as Styles from '@/styles'
import {Pressable} from 'react-native'
import './choice-list.css'
import type {IconType} from './icon'

type Option = {
  title: string
  description: string
  icon: IconType
  onClick: () => void
  onPress?: never
}

type Props = {
  options: Array<Option>
}

const Kb = {Box2, ClickableBox3, IconAuto, Text}

const ChoiceList = (props: Props) => {
  const {options} = props

  if (!isMobile) {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        {options.map((op, idx) => {
          const iconType = op.icon
          return (
            <Kb.ClickableBox3 key={idx} onClick={() => op.onClick()} direction="horizontal" fullWidth={true} style={styles.entry} className="cl-entry">
                <Kb.Box2
                  direction="vertical"
                  centerChildren={true}
                  style={styles.iconContainer}
                  className="cl-icon-container"
                >
                  {typeof op.icon === 'string' ? (
                    <Kb.IconAuto style={styles.icon} type={iconType} className="cl-icon" />
                  ) : (
                    <Kb.Box2 direction="vertical" style={styles.icon} className="cl-icon">
                      {op.icon}
                    </Kb.Box2>
                  )}
                </Kb.Box2>
                <Kb.Box2
                  direction="vertical"
                  alignItems="flex-start"
                  justifyContent="center"
                  flex={1}
                  style={styles.infoContainer}
                >
                  <Text type="BodyBigLink">{op.title}</Text>
                  <Text type="Body">{op.description}</Text>
                </Kb.Box2>
            </Kb.ClickableBox3>
          )
        })}
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {options.map((op, idx) => {
        const iconType = op.icon
        return (
          <Pressable
            key={idx}
            onPress={op.onClick}
            style={({pressed}) => Styles.collapseStyles([styleEntry, pressed && {backgroundColor: Styles.globalColors.blueLighter2}])}
          >
            {({pressed}) => (
              <Kb.Box2 direction="horizontal" fullWidth={true}>
                <Kb.Box2 direction="vertical" centerChildren={true} style={styleIconContainer(pressed)}>
                  {typeof op.icon === 'string' ? (
                    <IconAuto style={styleIcon} type={iconType} />
                  ) : (
                    <Kb.Box2 direction="vertical" style={styleIcon}>
                      {op.icon}
                    </Kb.Box2>
                  )}
                </Kb.Box2>
                <Kb.Box2 direction="vertical" justifyContent="center" flex={1} style={styleInfoContainer}>
                  <Kb.Text style={styleInfoTitle} type="Header">
                    {op.title}
                  </Kb.Text>
                  <Kb.Text type="Body">{op.description}</Kb.Text>
                </Kb.Box2>
              </Kb.Box2>
            )}
          </Pressable>
        )
      })}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  entry: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.clickable,
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
    },
  }),
  icon: {
    ...Styles.size(48),
  },
  iconContainer: {
    background: Styles.globalColors.greyLight,
    ...Styles.size(80),
  },
  infoContainer: {
    marginLeft: Styles.globalMargins.small,
    textAlign: 'left',
  },
}))

const styleEntry = {
  paddingBottom: Styles.globalMargins.tiny,
  paddingLeft: Styles.globalMargins.small,
  paddingRight: Styles.globalMargins.small,
  paddingTop: Styles.globalMargins.tiny,
}

const styleIconContainer = (isActive: boolean) =>
  ({
    alignSelf: 'center',
    borderRadius: (Styles.globalMargins.large + Styles.globalMargins.medium) / 2,
    height: Styles.globalMargins.large + Styles.globalMargins.medium,
    ...(isActive ? {} : {backgroundColor: Styles.globalColors.greyLight}),
    width: Styles.globalMargins.large + Styles.globalMargins.medium,
  }) as const

const styleIcon = {
  height: Styles.globalMargins.large,
  width: Styles.globalMargins.large,
}

const styleInfoContainer = {
  marginLeft: Styles.globalMargins.small,
}

const styleInfoTitle = {
  color: Styles.globalColors.blueDark,
}

export default ChoiceList
