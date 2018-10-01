// @flow
import * as React from 'react'
import Box from './box'
import PopupDialog from './popup-dialog'
import Icon from './icon'
import {
  type StylesCrossPlatform,
  collapseStyles,
  globalStyles,
  globalColors,
  globalMargins,
  glamorous,
  isMobile,
  desktopStyles,
} from '../styles'

type Props = {
  onChanged: (selected: React.Node) => void,
  selected?: React.Node,
  items: Array<React.Node>,
  style?: StylesCrossPlatform,
  disabled: boolean,
}
type State = {
  expanded: boolean,
}
class Dropdown extends React.Component<Props, State> {
  state = {expanded: false}

  static defaultProps = {
    disabled: false,
  }

  _toggleOpen = () => {
    this.setState(prevProps => ({
      expanded: !prevProps.expanded,
    }))
  }

  _onSelect = (n: React.Node) => {
    this.props.onChanged && this.props.onChanged(n)
    this.setState({expanded: false})
  }

  render() {
    return (
      <Box style={collapseStyles([{width: isMobile ? '100%' : 270}, this.props.style])}>
        <ButtonBox onClick={!this.props.disabled ? this._toggleOpen : null} disabled={this.props.disabled}>
          {this.state.expanded && (
            <PopupDialog
              onClose={this._toggleOpen}
              styleCover={{
                backgroundColor: globalColors.transparent,
                bottom: undefined,
                left: undefined,
                padding: undefined,
                right: undefined,
                top: undefined,
                zIndex: 999,
              }}
              styleClose={{opacity: 0}}
              styleClipContainer={{borderRadius: 4, marginTop: 80}}
            >
              <Box style={{height: '100%', width: '100%'}}>
                <Box
                  style={{
                    ...globalStyles.flexBoxColumn,
                    ...desktopStyles.scrollable,
                    border: `1px solid ${globalColors.blue}`,
                    borderRadius: 4,
                    maxHeight: 300,
                    width: 270,
                  }}
                >
                  {this.props.items.map((i, idx) => (
                    <ItemBox key={idx} onClick={() => this._onSelect(i)}>
                      {i}
                    </ItemBox>
                  ))}
                </Box>
              </Box>
            </PopupDialog>
          )}
          <Box style={{...globalStyles.flexBoxCenter, minHeight: isMobile ? 48 : 32, width: '100%'}}>
            {this.props.selected}
          </Box>
          <Icon
            type="iconfont-caret-down"
            inheritColor={true}
            fontSize={isMobile ? 12 : 8}
            style={{marginTop: isMobile ? 4 : -8}}
          />
        </ButtonBox>
      </Box>
    )
  }
}

const ItemBox = glamorous(Box)({
  ...globalStyles.flexBoxRow,
  ...(isMobile
    ? {}
    : {
        ':hover': {
          backgroundColor: globalColors.blue4,
        },
      }),
  borderBottomWidth: 1,
  borderColor: globalColors.black_10,
  borderStyle: 'solid',
  minHeight: 32,
  width: '100%',
})

const ButtonBox = glamorous(Box)(props => ({
  ...globalStyles.flexBoxRow,
  ...(!props.disabled && !isMobile
    ? {':hover': {border: `solid 1px ${globalColors.blue}`, color: globalColors.blue}, cursor: 'pointer'}
    : {}),
  ...(props.disabled ? {opacity: 0.3} : {}),
  alignItems: 'center',
  borderColor: globalColors.black_10,
  borderRadius: 100,
  borderStyle: 'solid',
  borderWidth: 1,
  color: globalColors.black_40,
  paddingRight: isMobile ? globalMargins.large : globalMargins.small,
  width: '100%',
}))

export default Dropdown
