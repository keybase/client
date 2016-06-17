// @flow
import React, {Component} from 'react'
import {TouchableWithoutFeedback} from 'react-native'
import type {Props} from './list'
import {Box, Text, Icon} from '../common-adapters'
import Row from './row'
import {globalStyles, globalColors} from '../styles/style-guide'

type State = {
  showIgnored: boolean
}

const rowKey = users => users && users.map(u => u.username).join('-')

const Ignored = ({showIgnored, ignored, styles, onToggle, isPublic}) => {
  return (
    <Box style={stylesIgnoreContainer}>
      <TouchableWithoutFeedback onPress={onToggle}>
        <Box style={styles.topBox}>
          <Text type='BodySmallSemibold' style={styles.dividerText}>Ignored folders</Text>
          <Icon type={showIgnored ? styles.iconCaretDown : styles.iconCaretRight} style={stylesIgnoreCaret} />
        </Box>
      </TouchableWithoutFeedback>
      {showIgnored && <Box style={styles.bottomBox}>
        <Text type='BodySmallSemibold' style={styles.dividerBodyText}>Ignored folders won't show up on your computer and you won't receive alerts about them.</Text>
      </Box>}
      {showIgnored && (ignored || []).map((i, idx) => (
        <Row
          key={rowKey(i.users)}
          {...i}
          users={i.users}
          isPublic={isPublic}
          ignored={true} // eslint-disable-line
          isFirst={!idx} />
        ))}
    </Box>
  )
}

class Render extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      showIgnored: false,
    }
  }

  render () {
    const styles = this.props.isPublic ? stylesPublic : stylesPrivate

    return (
      <Box style={stylesContainer}>
        {this.props.tlfs && this.props.tlfs.map((t, idx) => (
          <Row
            key={rowKey(t.users)}
            {...t}
            isPublic={this.props.isPublic}
            ignored={false}
            isFirst={!idx} />
          ))}
        <Ignored ignored={this.props.ignored} showIgnored={this.state.showIgnored} styles={styles}
          isPublic={this.props.isPublic} onToggle={() => this.setState({showIgnored: !this.state.showIgnored})} />
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const stylesIgnoreContainer = {
  ...globalStyles.flexBoxColumn,
}

const stylesIgnoreDesc = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

const stylesIgnoreDivider = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  padding: 7,
  height: 32,
}

const stylesDividerText = {
  ...globalStyles.clickable,
  marginRight: 7,
}

const stylesDividerBodyText = {
  width: 360,
  padding: 7,
  textAlign: 'center',
}

const stylesIgnoreCaret = {
  color: globalColors.white_75,
  width: 8,
  height: 8,
}

const stylesPrivate = {
  topBox: {
    ...stylesIgnoreDivider,
    backgroundColor: globalColors.darkBlue3,
  },
  dividerText: {
    ...stylesDividerText,
    color: globalColors.white_75,
  },
  dividerBodyText: {
    ...stylesDividerBodyText,
    color: globalColors.white_40,
  },
  bottomBox: {
    ...stylesIgnoreDesc,
    backgroundColor: globalColors.darkBlue3,
  },
  iconCaretRight: 'caret-right-white',
  iconCaretDown: 'caret-down-white',
}

const stylesPublic = {
  topBox: {
    ...stylesIgnoreDivider,
    backgroundColor: globalColors.lightGrey,
  },
  dividerText: {
    ...stylesDividerText,
    color: globalColors.black_40,
  },
  dividerBodyText: {
    ...stylesDividerBodyText,
    color: globalColors.black_40,
  },
  bottomBox: {
    ...stylesIgnoreDesc,
    backgroundColor: globalColors.lightGrey,
  },
  iconCaretRight: 'caret-right-black',
  iconCaretDown: 'caret-down-black',
}
export default Render
