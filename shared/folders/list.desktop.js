// @flow
import React, {Component} from 'react'
import Row from './row'
import some from 'lodash/some'
import type {IconType} from '../common-adapters/icon'
import type {Props} from './list'
import {Box, Text, Icon, List} from '../common-adapters'
import {globalStyles, globalColors, desktopStyles, platformStyles} from '../styles'

const Ignored = ({rows, showIgnored, styles, onToggle, isPublic, onClick}) => {
  const caretIcon: IconType = showIgnored ? 'iconfont-caret-down' : 'iconfont-caret-right'

  return (
    <Box style={stylesIgnoreContainer}>
      <Box style={styles.topBox} onClick={onToggle}>
        <Text type="BodySmallSemibold" style={stylesDividerText}>
          Ignored folders
        </Text>
        <Icon type={caretIcon} style={{color: globalColors.black_40}} />
      </Box>
      {showIgnored && (
        <Box style={styles.bottomBox}>
          <Text type="BodySmall" style={stylesDividerBodyText}>
            Ignored folders won't show up on your computer and you won't receive alerts about them.
          </Text>
        </Box>
      )}
    </Box>
  )
}

class ListRender extends Component<Props> {
  static defaultProps: {
    extraRows: Array<any>,
    ignored: Array<any>,
    tlfs: Array<any>,
  }
  _renderItem = (index: number, item: any) => {
    if (index < this.props.extraRows.length) {
      return this.props.extraRows[index]
    }

    // TODO how this works is HORRIBLE. This is just a short term fix to
    // take this very very old code that we're about to throw out and have it so its not rendering every single row
    const tlfsIdx = index - this.props.extraRows.length
    const ignoredIdx = tlfsIdx - this.props.tlfs.length - 1 // 1 because we have the divider
    const isTLF = tlfsIdx < this.props.tlfs.length
    const tlf = isTLF ? this.props.tlfs[tlfsIdx] : this.props.ignored[ignoredIdx]

    if (!isTLF && ignoredIdx === -1) {
      // divider
      return (
        <Ignored
          isPublic={this.props.isPublic}
          showIgnored={this.props.showIgnored}
          styles={this.props.isPublic ? stylesPublic : stylesPrivate}
          onToggle={this.props.onToggleShowIgnored}
        />
      )
    }

    return (
      <Row
        {...tlf}
        key={String(index)}
        isPublic={this.props.type === 'public'}
        isTeam={this.props.type === 'team'}
        hasReadOnlyUsers={tlf.users && some(tlf.users, 'readOnly')}
        ignored={!isTLF}
        installed={this.props.installed}
        onChat={this.props.onChat}
        onClick={this.props.onClick}
        onRekey={this.props.onRekey}
        onOpen={this.props.onOpen}
        smallMode={this.props.smallMode}
      />
    )
  }

  render() {
    const realCSS = `
      .folder-row .folder-row-hover-action { visibility: hidden; }
      .folder-row:hover .folder-row-hover-action { visibility: visible; }
      .folder-row:hover .folder-row-hover-action:hover { text-decoration: underline; }
    `

    return (
      <Box style={{...stylesContainer, ...this.props.style}}>
        <style>{realCSS}</style>
        <List
          items={[
            ...this.props.extraRows,
            ...this.props.tlfs,
            ...(!this.props.smallMode && this.props.ignored.length ? ['ignoreDivider'] : []),
            ...(!this.props.smallMode && this.props.showIgnored ? this.props.ignored : []),
          ]}
          renderItem={this._renderItem}
          fixedHeight={this.props.smallMode ? 48 : 56}
        />
      </Box>
    )
  }
}

ListRender.defaultProps = {
  extraRows: [],
  ignored: [],
  tlfs: [],
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

const stylesDividerText = platformStyles({
  isElectron: {
    ...desktopStyles.clickable,
    marginRight: 7,
  },
})

const stylesDividerBodyText = {
  width: 360,
  padding: 7,
  textAlign: 'center',
}

const stylesPrivate = {
  topBox: {
    ...stylesIgnoreDivider,
    backgroundColor: globalColors.white,
    color: globalColors.white_75,
    borderBottom: 'solid 1px rgba(255, 255, 255, 0.05)',
  },
  bottomBox: {
    ...stylesIgnoreDesc,
    backgroundColor: globalColors.white,
    color: globalColors.white_40,
  },
}

const stylesPublic = {
  topBox: {
    ...stylesIgnoreDivider,
    backgroundColor: globalColors.white,
    color: globalColors.black_40,
    borderBottom: 'solid 1px rgba(0, 0, 0, 0.05)',
  },
  bottomBox: {
    ...stylesIgnoreDesc,
    backgroundColor: globalColors.white,
    color: globalColors.black_40,
  },
}
export default ListRender
