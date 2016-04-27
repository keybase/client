// @flow
import React, {Component} from 'react'

import Text from './text'
import {transition, globalColors, globalStyles} from '../styles/style-guide'

import type {Props, MenuItemProps} from './dropdown'
import type {Props as TextProps} from './text'

import Popover from 'material-ui/lib/popover/popover'
import PopoverAnimationFromTop from 'material-ui/lib/popover/popover-animation-from-top'
import DropDownArrow from 'material-ui/lib/svg-icons/navigation/arrow-drop-down'

export default class Dropdown extends Component {
  props: Props;

  state: {
    popoverOpen: boolean
  };

  _dropdownRef: any;

  constructor (props: Props) {
    super(props)
    this.state = {
      popoverOpen: false
    }
  }

  _clickItemFromList (index: ?number) {
    // Use != null because 0 is false
    if (index != null) {
      this.props.onClick(this.props.options[index], index)
    }

    this.setState({popoverOpen: false})
  }

  render () {
    const realCSS = `
      .kbdropdown { color: ${globalColors.black10}; }
      .kbdropdown:hover { color: ${globalColors.blue}; }

      .kbdropdown svg { fill: ${globalColors.black10} !important; }
      .kbdropdown:hover svg { fill: ${globalColors.blue} !important; }

      .popover .kbmenuitem:hover { background-color: ${globalColors.blue4}; }
      .popover .kbmenuitem+.kbmenuitem { border-top: 1px solid ${globalColors.black10}; }
    `

    let list
    let selectedValue

    const onOther = this.props.onOther && (() => { this.setState({popoverOpen: false}); this.props.onOther && this.props.onOther() })

    switch (this.props.type) {
      case 'Username':
        list = <UsernameList options={this.props.options} onClick={i => this._clickItemFromList(i)} onOther={onOther} />
        selectedValue = <MenuItem onClick={() => {}} type='Username' style={{height: 'initial'}} textStyle={{...styles.labelStyle}}>{this.props.value || this.props.options[0]}</MenuItem>
        break
      case 'General':
        list = <GeneralList options={this.props.options} onClick={i => this._clickItemFromList(i)} onOther={onOther} />
        selectedValue = <MenuItem type='Pick' onClick={() => {}} style={{height: 'initial'}} textStyle={{...styles.labelStyle}}>{this.props.value || 'Pick an option'}</MenuItem>
        break
    }

    return (
      <div>
        <style>{realCSS}</style>
        <div
          ref={r => (this._dropdownRef = r)}
          style={{...styles.dropdown, ...this.props.style}}
          onClick={() => this.setState({popoverOpen: true})}
          className={'kbdropdown'}>
          <Popover
            className={'popover'}
            anchorOrigin={{horizontal: 'middle', vertical: 'top'}}
            targetOrigin={{horizontal: 'middle', vertical: 'top'}}
            anchorEl={this._dropdownRef}
            style={styles.menuStyle}
            animation={PopoverAnimationFromTop}
            open={this.state.popoverOpen}
            onRequestClose={() => this.setState({popoverOpen: false})}>
            {list}
          </Popover>
          {selectedValue}
          <DropDownArrow style={styles.iconStyle} />
        </div>
      </div>
    )
  }
}

class MenuItem extends Component<void, MenuItemProps, void> {
  props: MenuItemProps;

  render () {
    let textStyle : Object = {}
    let textType: TextProps.type = 'HeaderBig'

    switch (this.props.type || 'Normal') {
      case 'Normal':
        break
      case 'Username':
        textStyle = {color: globalColors.orange}
        break
      case 'Other':
      case 'Pick':
        textType = 'Header'
        textStyle = globalStyles.fontSemibold
        break
    }

    return (
      <div className='kbmenuitem' style={{...styles.menuItem, ...this.props.style}} onClick={this.props.onClick}>
        <Text style={{...textStyle, ...this.props.textStyle}} type={textType}>{this.props.children}</Text>
      </div>
    )
  }
}

type OptionsListProps = {
  options: Array<string>,
  onClick: (i: ?number) => void,
  onOther?: () => void,
  username?: true
}

const optionsList = ({options, onClick, username}: OptionsListProps) => {
  return options.map((o, i) => <MenuItem onClick={() => onClick(i)} key={o} type={username ? 'Username' : 'Normal'}>{o}</MenuItem>)
}

const UsernameList = ({options, onClick, onOther}: OptionsListProps) => {
  return (
    <div style={styles.popover}>
      {optionsList({onClick, options, username: true})}
      {onOther && <MenuItem onClick={onOther} type='Other'>Someone else...</MenuItem>}
    </div>
  )
}

const GeneralList = ({options, onClick, onOther}: OptionsListProps) => {
  return (
    <div style={styles.popover}>
      <MenuItem onClick={() => onClick()} type='Pick'>Pick an option</MenuItem>
      {optionsList({onClick, options})}
      {onOther && <MenuItem onClick={onOther} type='Other'>Or something else</MenuItem>}
    </div>
  )
}

const styles = {
  dropdown: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 100,
    position: 'relative',
    height: 36,
    ...transition('color')
  },

  labelStyle: {
    lineHeight: '36px',
    paddingLeft: 15,
    paddingRight: 30,
    minWidth: 268,
    textAlign: 'center',
    alignItems: 'initial'
  },

  iconStyle: {
    position: 'absolute',
    top: 5,
    right: 8
  },

  menuStyle: {
    ...globalStyles.rounded,
    borderColor: globalColors.blue,
    transformOrigin: 'center top',
    borderStyle: 'solid',
    borderWidth: 1
  },

  popover: {
    ...globalStyles.flexBoxColumn,
    width: 290
  },

  menuItem: {
    ...globalStyles.clickable,
    height: 50,
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
}
