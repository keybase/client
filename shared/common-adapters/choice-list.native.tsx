import Box from './box'
import ClickableBox from './clickable-box'
import Icon from './icon'
import Text from './text'
import * as React from 'react'
import * as Styles from '@/styles'
import type {Props} from './choice-list'

type State = {
  activeIndex?: number
}

const Kb = {
  Box,
  ClickableBox,
  Icon,
  Text,
}

class ChoiceList extends React.Component<Props, State> {
  state: State = {activeIndex: undefined}

  componentDidUpdate(prevProps: Props) {
    if (prevProps !== this.props) {
      this.setState({activeIndex: undefined})
    }
  }

  render() {
    const {options} = this.props
    return (
      <Kb.Box>
        {options.map((op, idx) => {
          const iconType = op.icon
          return (
            <Kb.ClickableBox
              key={idx}
              underlayColor={Styles.globalColors.blueLighter2}
              onClick={op.onClick}
              onPressIn={() => this.setState({activeIndex: idx})}
              onPressOut={() => this.setState({activeIndex: undefined})}
            >
              <Kb.Box style={styleEntry}>
                <Kb.Box style={styleIconContainer(this.state.activeIndex === idx)}>
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
