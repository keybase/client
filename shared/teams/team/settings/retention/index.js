// @flow
import * as React from 'react'
import {globalStyles, isMobile} from '../../../../styles'
import {Box, Text} from '../../../../common-adapters'
import PopupMenu, {type MenuItem, ModalLessPopupMenu} from '../../../../common-adapters/popup-menu'
import {ModalPositionRelative} from '../../../../common-adapters/relative-popup-hoc'
import {type RetentionPolicy, type _RetentionPolicy} from '../../../../constants/types/teams'

export type Props = {
  policy: RetentionPolicy,
  teamPolicy?: RetentionPolicy,
  onSelect?: _RetentionPolicy => void,
  isTeamWide: boolean,
}

type State = {
  selected: _RetentionPolicy,
  items: Array<MenuItem | 'Divider' | null>,
  showMenu: boolean,
  dropdownRect: ?ClientRect,
}

const commonOptions = [1, 7, 30, 90, 365]

class RetentionPicker extends React.Component<Props, State> {
  state = {
    selected: {type: 'retain', days: 0},
    items: [],
    showMenu: false,
    dropdownRect: null,
  }

  _labelBox: ?Box

  _onSelect = (val: number | 'retain' | 'inherit') => {
    let selected: _RetentionPolicy
    if (typeof val === 'number') {
      selected = {type: 'expire', days: val}
    } else if (val === 'retain') {
      selected = {type: 'retain', days: 0}
    } else {
      selected = {type: 'inherit', days: 0}
    }
    this.setState({selected})
    this.props.onSelect && this.props.onSelect(selected)
  }

  _makeItems = () => {
    const items = commonOptions.map(days => ({
      title: daysToLabel(days),
      onClick: () => this._onSelect(days),
    }))
    items.push({title: 'Keep forever', onClick: () => this._onSelect('retain')})
    if (!this.props.isTeamWide && this.props.teamPolicy) {
      // Add inherit option
      const teamTitle = policyToLabel(this.props.teamPolicy)
      const inheritTitle = `Use team default (${teamTitle})`
      items.unshift({title: inheritTitle, onClick: () => this._onSelect('inherit')})
    }
    this.setState({items})
  }

  _setSelected = (policy?: RetentionPolicy) => {
    if (policy) {
      this.setState({selected: policy})
    } else if (this.props.policy) {
      this.setState({selected: this.props.policy})
    }
  }

  _label = () => {
    return policyToLabel(this.state.selected, this.props.teamPolicy)
  }

  componentDidMount() {
    this._makeItems()
    this._setSelected()
  }

  componentWillReceiveProps(nextProps: Props) {
    if (
      nextProps.policy !== this.props.policy ||
      nextProps.teamPolicy !== this.props.teamPolicy ||
      nextProps.isTeamWide !== this.props.isTeamWide
    ) {
      this._makeItems()
      this._setSelected(nextProps.policy)
    }
  }

  _setRef = (box: ?Box) => {
    this._labelBox = box
  }

  _showMenu = (evt: SyntheticEvent<Element>) => {
    this.setState({
      dropdownRect: isMobile ? null : evt.currentTarget.getBoundingClientRect(),
      showMenu: true,
    })
  }

  _hideMenu = () => this.setState({showMenu: false})

  render() {
    return (
      <Box ref={this._setRef} onClick={this._showMenu} style={{...globalStyles.flexBoxRow}}>
        {this.props.policy && <Text type="BodySemibold">{this._label()}</Text>}
        {this.state.showMenu && (
          <OptionsPopup
            targetRect={this.state.dropdownRect}
            position="top left"
            onClosePopup={this._hideMenu}
            onHide={this._hideMenu}
            popupNode={<Box />}
            style={{backgroundColor: 'white'}}
            items={this.state.items}
          />
        )}
      </Box>
    )
  }
}

const RenderOptions = (props: {items: Array<MenuItem | 'Divider' | null>, onHide: () => any}) =>
  isMobile ? (
    <PopupMenu onHidden={props.onHide} style={{overflow: 'visible'}} items={props.items} />
  ) : (
    <ModalLessPopupMenu
      onHidden={props.onHide}
      style={{overflow: 'visible', width: 220}}
      items={props.items}
    />
  )
// TODO mobile
const OptionsPopup = ModalPositionRelative(RenderOptions)

// Utilities for transforming retention policies <-> menu items
const policyToLabel = (p: _RetentionPolicy, parent: ?_RetentionPolicy) => {
  switch (p.type) {
    case 'retain':
      return 'Keep forever'
    case 'expire':
      return daysToLabel(p.days)
    case 'inherit':
      if (!parent) {
        throw new Error(`Got policy of type 'inherit' without an inheritable parent policy`)
      }
      return policyToLabel(parent)
  }
  return ''
}
const daysToLabel = (days: number) => {
  let label = `${days} day`
  if (days !== 1) {
    label += 's'
  }
  return label
}

export default RetentionPicker
