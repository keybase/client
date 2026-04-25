import {Box2} from './box'
import ClickableBox from './clickable-box'
import IconAuto from './icon-auto'
import Text from './text'
import * as React from 'react'
import * as Styles from '@/styles'
import type {Props} from './choice-list'

const Kb = {Box2, ClickableBox, IconAuto, Text}

const ChoiceList = (props: Props) => {
  const {options} = props
  const [active, setActive] = React.useState<{index?: number; options: Props['options']}>(() => ({
    options,
  }))
  const activeIndex = active.options === options ? active.index : undefined

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {options.map((op, idx) => {
        const iconType = op.icon
        return (
          <Kb.ClickableBox
            key={idx}
            underlayColor={Styles.globalColors.blueLighter2}
            onClick={op.onClick}
            onPressIn={() => setActive({index: idx, options})}
            onPressOut={() => setActive({options})}
          >
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styleEntry}>
              <Kb.Box2 direction="vertical" centerChildren={true} style={styleIconContainer(activeIndex === idx)}>
                {typeof op.icon === 'string' ? (
                  <IconAuto style={styleIcon} type={iconType} />
                ) : (
                  <Kb.Box2 direction="vertical" style={styleIcon}>{op.icon}</Kb.Box2>
                )}
              </Kb.Box2>
              <Kb.Box2 direction="vertical" justifyContent="center" flex={1} style={styleInfoContainer}>
                <Kb.Text style={styleInfoTitle} type="Header">
                  {op.title}
                </Kb.Text>
                <Kb.Text type="Body">{op.description}</Kb.Text>
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
  marginLeft: Styles.globalMargins.small,
}

const styleInfoTitle = {
  color: Styles.globalColors.blueDark,
}

export default ChoiceList
