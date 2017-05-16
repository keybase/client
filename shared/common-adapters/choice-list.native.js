// @flow
import Box from './box'
import ClickableBox from './clickable-box'
import Icon from './icon'
import Text from './text'
import React, {Component} from 'react'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props} from './choice-list'

type State = {
  activeIndex: ?number,
}

class ChoiceList extends Component<void, Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      activeIndex: null,
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps !== this.props) {
      this.setState({
        activeIndex: null,
      })
    }
  }

  render() {
    const {options} = this.props
    return (
      <Box>
        {options.map((op, idx) => (
          <ClickableBox
            key={idx}
            underlayColor={globalColors.blue4}
            onClick={op.onClick}
            onPressIn={() => this.setState({activeIndex: idx})}
            onPressOut={() => this.setState({activeIndex: null})}
          >
            <Box style={styleEntry}>
              <Box style={styleIconContainer(this.state.activeIndex === idx)}>
                {typeof op.icon === 'string'
                  ? <Icon style={styleIcon} type={op.icon} />
                  : <Box style={styleIcon}>{op.icon}</Box>}
              </Box>
              <Box style={styleInfoContainer}>
                <Text style={styleInfoTitle} type="Header">{op.title}</Text>
                <Text type="Body">{op.description}</Text>
              </Box>
            </Box>
          </ClickableBox>
        ))}
      </Box>
    )
  }
}

const styleEntry = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
}

const styleIconContainer = active => ({
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
  width: globalMargins.large + globalMargins.medium,
  height: globalMargins.large + globalMargins.medium,
  ...(active ? {} : {backgroundColor: globalColors.lightGrey}),
  borderRadius: (globalMargins.large + globalMargins.medium) / 2,
})

const styleIcon = {
  width: globalMargins.large,
  height: globalMargins.large,
}

const styleInfoContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  marginLeft: globalMargins.small,
}

const styleInfoTitle = {
  color: globalColors.blue,
}

export default ChoiceList
