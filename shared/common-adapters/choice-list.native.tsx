import {Box2} from './box'
import ClickableBox from './clickable-box'
import Icon from './icon'
import {Text3} from './text3'
import * as React from 'react'
import * as Styles from '@/styles'
import type {Props} from './choice-list'

const Kb = {Box2, ClickableBox, Icon, Text3}

const ChoiceList = (props: Props) => {
  const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined)

  const {options} = props
  React.useEffect(() => {
    setActiveIndex(undefined)
  }, [options])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
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
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styleEntry}>
              <Kb.Box2 direction="vertical" centerChildren={true} style={styleIconContainer(activeIndex === idx)}>
                {typeof op.icon === 'string' ? (
                  <Icon style={styleIcon} type={iconType} />
                ) : (
                  <Kb.Box2 direction="vertical" style={styleIcon}>{op.icon}</Kb.Box2>
                )}
              </Kb.Box2>
              <Kb.Box2 direction="vertical" style={styleInfoContainer}>
                <Kb.Text3 style={styleInfoTitle} type="Header">
                  {op.title}
                </Kb.Text3>
                <Kb.Text3 type="Body">{op.description}</Kb.Text3>
              </Kb.Box2>
            </Kb.Box2>
          </Kb.ClickableBox>
        )
      })}
    </Kb.Box2>
  )
}

const styleEntry = {
  paddingBottom: Styles.globalMargins.tiny,
  paddingLeft: Styles.globalMargins.small,
  paddingRight: Styles.globalMargins.small,
  paddingTop: Styles.globalMargins.tiny,
}

const styleIconContainer = (active: boolean) =>
  ({
    alignSelf: 'center',
    borderRadius: (Styles.globalMargins.large + Styles.globalMargins.medium) / 2,
    height: Styles.globalMargins.large + Styles.globalMargins.medium,
    ...(active ? {} : {backgroundColor: Styles.globalColors.greyLight}),
    width: Styles.globalMargins.large + Styles.globalMargins.medium,
  }) as const

const styleIcon = {
  height: Styles.globalMargins.large,
  width: Styles.globalMargins.large,
}

const styleInfoContainer = {
  flex: 1,
  justifyContent: 'center',
  marginLeft: Styles.globalMargins.small,
} as const

const styleInfoTitle = {
  color: Styles.globalColors.blueDark,
}

export default ChoiceList
