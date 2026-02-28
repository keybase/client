import Box from './box'
import ClickableBox from './clickable-box'
import Icon from './icon'
import Text from './text'
import * as React from 'react'
import * as Styles from '@/styles'
import type {Props} from './choice-list'

const Kb = {Box, ClickableBox, Icon, Text}

const ChoiceList = (props: Props) => {
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined)

  const {options} = props
  React.useEffect(() => {
    setActiveIndex(undefined)
  }, [options])

  return (
    <Kb.Box>
      {options.map((op, idx) => {
        const iconType = op.icon
        return (
          <Kb.ClickableBox
            key={idx}
            underlayColor={Styles.globalColors.blueLighter2}
            onClick={op.onClick}
            onPressIn={() => setActiveIndex(idx)}
            onPressOut={() => setActiveIndex(undefined)}
          >
            <Kb.Box style={styleEntry}>
              <Kb.Box style={styleIconContainer(activeIndex === idx)}>
                {typeof op.icon === 'string' ? (
                  <Icon style={styleIcon} type={iconType} />
                ) : (
                  <Kb.Box style={styleIcon}>{op.icon}</Kb.Box>
                )}
              </Kb.Box>
              <Kb.Box style={styleInfoContainer}>
                <Kb.Text style={styleInfoTitle} type="Header">
                  {op.title}
                </Kb.Text>
                <Kb.Text type="Body">{op.description}</Kb.Text>
              </Kb.Box>
            </Kb.Box>
          </Kb.ClickableBox>
        )
      })}
    </Kb.Box>
  )
}

const styleEntry = {
  ...Styles.globalStyles.flexBoxRow,
  paddingBottom: Styles.globalMargins.tiny,
  paddingLeft: Styles.globalMargins.small,
  paddingRight: Styles.globalMargins.small,
  paddingTop: Styles.globalMargins.tiny,
}

const styleIconContainer = (active: boolean) =>
  ({
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: (Styles.globalMargins.large + Styles.globalMargins.medium) / 2,
    height: Styles.globalMargins.large + Styles.globalMargins.medium,
    justifyContent: 'center',
    ...(active ? {} : {backgroundColor: Styles.globalColors.greyLight}),
    width: Styles.globalMargins.large + Styles.globalMargins.medium,
  }) as const

const styleIcon = {
  height: Styles.globalMargins.large,
  width: Styles.globalMargins.large,
}

const styleInfoContainer = {
  ...Styles.globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  marginLeft: Styles.globalMargins.small,
} as const

const styleInfoTitle = {
  color: Styles.globalColors.blueDark,
}

export default ChoiceList
