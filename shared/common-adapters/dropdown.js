// @flow
import * as React from 'react'
import Box from './box'
import PopupDialog from './popup-dialog'
import Icon from './icon'
import {globalStyles, globalColors, globalMargins, glamorous, isMobile, desktopStyles} from '../styles'

type Props = {
  onChanged: (selected: React.Node) => void,
  selected?: React.Node,
  items: Array<React.Node>,
  style?: any,
}
type State = {
  expanded: boolean,
  selected: React.Node,
}
class Dropdown extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      expanded: false,
      selected: props.selected,
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.selected !== nextProps.selected) {
      this.setState({selected: nextProps.selected})
    }
  }

  _toggleOpen = () => {
    this.setState(prevProps => ({
      expanded: !prevProps.expanded,
    }))
  }

  _onSelect = (n: React.Node) => {
    this.props.onChanged && this.props.onChanged(n)
    this.setState({
      expanded: false,
      selected: n,
    })
  }

  render() {
    return (
      <Box style={this.props.style}>
        <ButtonBox onClick={this._toggleOpen}>
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
          <Box
            style={{
              ...globalStyles.flexBoxCenter,
              minHeight: 40,
              width: '100%',
            }}
          >
            {this.state.selected}
          </Box>
          <Icon type="iconfont-caret-down" inheritColor={true} style={{fontSize: 11}} />
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
          backgroundColor: globalColors.blue3_40,
        },
      }),
  borderBottomWidth: 1,
  borderColor: globalColors.lightGrey2,
  borderStyle: 'solid',
  minHeight: 40,
  width: '100%',
})

const ButtonBox = glamorous(Box)({
  ...globalStyles.flexBoxRow,
  ...(isMobile
    ? {}
    : {
        ':hover': {
          border: `solid 1px ${globalColors.blue2}`,
          color: globalColors.blue2,
        },
      }),
  alignItems: 'center',
  borderColor: globalColors.lightGrey2,
  borderRadius: 100,
  borderStyle: 'solid',
  borderWidth: 1,
  color: globalColors.lightGrey2,
  paddingRight: globalMargins.small,
  width: 270,
})

export default Dropdown
