// @flow
import * as React from 'react'
import * as I from 'immutable'
import Row from './row/container'
import {
  Box,
  Text,
  Icon,
  ClickableBox,
  PopupMenu,
  HOCTimers,
  ProgressIndicator,
  ScrollView,
} from '../common-adapters'
import {globalStyles, globalColors, globalMargins, transition} from '../styles'
import {isMobile} from '../constants/platform'

type Props = {
  expandedSet: I.Set<string>,
  onShowDelete: (teamname: ?string, name: string) => void,
  onNewPersonalRepo: () => void,
  onNewTeamRepo: () => void,
  onToggleExpand: (id: string) => void,
  personals: Array<string>,
  setTimeout: (() => void, number) => number,
  teams: Array<string>,
}

type State = {
  showingCopy: boolean,
  showingMenu: boolean,
}

const Copied = ({showing}) => (
  <Box
    style={{
      ...transition('opacity'),
      backgroundColor: globalColors.black_60,
      borderRadius: 10,
      left: '50%',
      opacity: showing ? 1 : 0,
      padding: 5,
      position: 'absolute',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    }}
  >
    <Text type="Body" backgroundMode="Terminal">Copied!</Text>
  </Box>
)

class Git extends React.Component<Props, State> {
  state = {
    showingCopy: false,
    showingMenu: false,
  }

  _toggleMenu = () => {
    this.setState(prevState => ({
      showingMenu: !prevState.showingMenu,
    }))
  }

  // TODO
  // _onCopy = (url: string) => {
  // this.props.onCopy(url)
  // this.setState({showingCopy: true})
  // this.props.setTimeout(() => this.setState({showingCopy: false}), 1000)
  // }

  _menuItems = [
    {
      onClick: () => this.props.onNewPersonalRepo(),
      title: 'New personal repository',
    },
    {
      onClick: () => this.props.onNewTeamRepo(),
      title: 'New team repository',
    },
  ]

  _rowPropsToProps = (id: string) => ({
    expanded: this.props.expandedSet.has(id),
    key: id,
    onShowDelete: this.props.onShowDelete,
    onToggleExpand: this.props.onToggleExpand,
    repoID: id,
  })

  render() {
    return (
      <Box style={_gitStyle}>
        <ClickableBox style={_headerStyle} onClick={this._toggleMenu}>
          <Icon type="iconfont-new" style={{color: globalColors.blue, marginRight: globalMargins.tiny}} />
          <Text type="BodyBigLink">New encrypted git repository...</Text>
        </ClickableBox>
        {this.props.loading &&
          <ProgressIndicator style={{alignSelf: 'center', width: globalMargins.small}} />}
        <ScrollView>
          <Box style={_sectionHeaderStyle}>
            <Text type="BodySmallSemibold">Personal repositories</Text>
          </Box>
          {this.props.personals.map(p => <Row {...this._rowPropsToProps(p)} />)}
          <Box style={_sectionHeaderStyle}>
            <Text type="BodySmallSemibold">Team repositories</Text>
          </Box>
          {this.props.teams.map(p => <Row {...this._rowPropsToProps(p)} />)}
        </ScrollView>
        {this.state.showingMenu &&
          <PopupMenu items={this._menuItems} onHidden={this._toggleMenu} style={_popupStyle} />}
        <Copied showing={this.state.showingCopy} />
      </Box>
    )
  }
}

const _sectionHeaderStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 24,
  paddingLeft: globalMargins.tiny,
  width: '100%',
}

const _popupStyle = isMobile
  ? {}
  : {
      marginLeft: 'auto',
      marginRight: 'auto',
      marginTop: 40,
    }

const _headerStyle = {
  ...globalStyles.flexBoxCenter,
  ...globalStyles.flexBoxRow,
  flexShrink: 0,
  height: 48,
}

const _gitStyle = {
  ...globalStyles.flexBoxColumn,
  height: '100%',
  position: 'relative',
  width: '100%',
}

// $FlowIssue we need to fix up timer hoc props
export default HOCTimers(Git)
