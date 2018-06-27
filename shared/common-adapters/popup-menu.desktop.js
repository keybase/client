// @flow
import React, {Component} from 'react'
import type {ModalLessPopupMenuProps, Props, HeaderTextProps} from './popup-menu'
import {Box, Text} from '../common-adapters/index'
import EscapeHandler from '../util/escape-handler'
import {globalColors, globalMargins, globalStyles, desktopStyles} from '../styles'

class ModalLessPopupMenu extends Component<ModalLessPopupMenuProps> {
  render() {
    const realCSS = `
    .menu-hover:hover { background-color: ${
      this.props.hoverColor ? this.props.hoverColor : globalColors.blue4
    }; }
    .menu-hover-danger:hover { background-color: ${globalColors.red}; }

    .menu-hover .title { color: ${globalColors.black_75}; }
    .menu-hover-danger .title { color: ${globalColors.red}; }
    .menu-hover-danger:hover .title { color: ${globalColors.white}; }
    .menu-hover-danger .subtitle { color: ${globalColors.black_40}; }
    .menu-hover-danger:hover .subtitle { color: ${globalColors.white}; }
    `

    return (
      <Box>
        <style>{realCSS}</style>
        <Box style={{...stylesMenu, ...this.props.style}}>
          {this.props.header && this.props.header.view}
          {this.props.items.length > 0 && (
            <Box
              style={{
                ...globalStyles.flexBoxColumn,
                flexShrink: 0,
                paddingTop: globalMargins.tiny,
                paddingBottom: globalMargins.tiny,
              }}
            >
              {this.props.items.filter(Boolean).map((i, idx) => {
                if (i === 'Divider') {
                  return <Divider key={idx} />
                }

                let hoverClassName
                let styleDisabled = {}
                if (!i.disabled) {
                  hoverClassName = i.danger ? 'menu-hover-danger' : 'menu-hover'
                } else {
                  styleDisabled = {opacity: 0.4}
                }

                const styleClickable = i.disabled ? {} : desktopStyles.clickable

                return (
                  <Box
                    key={i.title}
                    className={hoverClassName}
                    style={{...stylesRow, ...styleClickable}}
                    onClick={event => {
                      i.onClick && i.onClick()
                      if (this.props.closeOnClick && this.props.onHidden) {
                        this.props.onHidden()
                        event.stopPropagation()
                      }
                    }}
                  >
                    {i.view ? (
                      i.view
                    ) : (
                      <Text
                        className="title"
                        type="Body"
                        style={{...stylesMenuText, ...i.style, ...styleDisabled}}
                      >
                        {i.title}
                      </Text>
                    )}
                    {!i.view &&
                      i.subTitle && (
                        <Text
                          className="subtitle"
                          key={i.subTitle}
                          type="BodySmall"
                          style={{...stylesMenuText, ...i.style}}
                        >
                          {i.subTitle}
                        </Text>
                      )}
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>
      </Box>
    )
  }
}

// TODO don't use this anymore
// TODO fix this so it's not broken
class PopupMenu extends Component<Props> {
  render() {
    return (
      <EscapeHandler onESC={this.props.onHidden}>
        <Box
          style={{...stylesMenuCatcher, ...this.props.styleCatcher}}
          onClick={e => {
            this.props.onHidden && this.props.onHidden()
            e.stopPropagation()
          }}
        >
          <ModalLessPopupMenu {...this.props} />
        </Box>
      </EscapeHandler>
    )
  }
}

// TEMP to just get the desktop release working. The previous change totally broke this in devices / git / etc
class OLDPopupMenu extends Component<Props> {
  render() {
    const realCSS = `
    .menu-hover:hover { background-color: ${this.props.hoverColor || globalColors.blue4}; }
    .menu-hover-danger:hover { background-color: ${globalColors.red}; }

    .menu-hover .title { color: ${globalColors.black_75}; }
    .menu-hover-danger .title { color: ${globalColors.red}; }
    .menu-hover-danger:hover .title { color: ${globalColors.white}; }
    .menu-hover-danger .subtitle { color: ${globalColors.black_40}; }
    .menu-hover-danger:hover .subtitle { color: ${globalColors.white}; }
    `

    return (
      <EscapeHandler onESC={this.props.onHidden}>
        <Box
          style={stylesMenuCatcher}
          onClick={e => {
            this.props.onHidden && this.props.onHidden()
            e.stopPropagation()
          }}
        >
          <style>{realCSS}</style>
          <Box style={{...stylesMenu, ...this.props.style}}>
            {this.props.header && this.props.header.view}
            <Box
              style={{
                ...globalStyles.flexBoxColumn,
                flexShrink: 0,
                paddingTop: globalMargins.tiny,
                paddingBottom: globalMargins.tiny,
              }}
            >
              {this.props.items.filter(Boolean).map((i, idx) => {
                if (i === 'Divider') {
                  return <Divider key={idx} />
                }

                let hoverClassName
                let styleDisabled = {}
                if (!i.disabled) {
                  hoverClassName = i.danger ? 'menu-hover-danger' : 'menu-hover'
                } else {
                  styleDisabled = {opacity: 0.4}
                }

                const styleClickable = i.disabled ? {} : desktopStyles.clickable

                return (
                  <Box
                    key={i.title}
                    className={hoverClassName}
                    style={{...stylesRow, ...styleClickable}}
                    onClick={i.onClick}
                  >
                    <Text
                      className="title"
                      type="Body"
                      style={{...stylesMenuText, ...i.style, ...styleDisabled}}
                    >
                      {i.title}
                    </Text>
                    {i.subTitle && (
                      <Text
                        className="subtitle"
                        key={i.subTitle}
                        type="BodySmall"
                        style={{...stylesMenuText, ...i.style}}
                      >
                        {i.subTitle}
                      </Text>
                    )}
                  </Box>
                )
              })}
            </Box>
          </Box>
        </Box>
      </EscapeHandler>
    )
  }
}

const Divider = () => (
  <Box style={{height: 1, backgroundColor: globalColors.black_05, marginTop: 8, marginBottom: 8}} />
)

const PopupHeaderText = ({color, backgroundColor, style, children}: HeaderTextProps) => (
  <Text
    type="BodySmallSemibold"
    style={{
      textAlign: 'center',
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
      paddingTop: globalMargins.tiny,
      paddingBottom: globalMargins.tiny,
      color,
      backgroundColor,
      ...style,
    }}
  >
    {children}
  </Text>
)

const stylesRow = {
  ...globalStyles.flexBoxColumn,
  paddingTop: globalMargins.xtiny,
  paddingBottom: globalMargins.xtiny,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
}

const stylesMenuCatcher = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
}

const stylesMenu = {
  ...globalStyles.flexBoxColumn,
  minWidth: 200,
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  backgroundColor: globalColors.white,
  borderRadius: 3,
  boxShadow: '0 0 15px 0 rgba(0, 0, 0, 0.2)',
  overflowX: 'hidden',
  overflowY: 'auto',
}

const stylesMenuText = {
  color: undefined,
}

export {PopupHeaderText, ModalLessPopupMenu, OLDPopupMenu}

export default PopupMenu
