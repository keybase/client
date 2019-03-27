// @flow

import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {formatTimeForMessages} from '../../../util/timestamp'

const hitHeight = 30
const arrowSize = Styles.isMobile ? 20 : 16

type SearchHit = {|
  author: string,
  summary: string,
  timestamp: number,
|}
export type Props = {
  hits: Array<SearchHit>,
  loadSearchHit: number => void,
  onCancel: () => void,
  onSearch: string => void,
  selfHide: () => void,
  status: Types.ThreadSearchStatus,
  style?: Styles.StylesCrossPlatform,
}

type State = {|
  selectedIndex: number,
|}

class ThreadSearchBase extends React.Component<Props, State> {
  state = {selectedIndex: 0}
  _text: string
  _lastSearch: string

  submitSearch = () => {
    this._lastSearch = this._text
    this.setState({selectedIndex: 0})
    this.props.onSearch(this._text)
  }

  selectResult = (index: number) => {
    this.props.loadSearchHit(index)
    this.setState({selectedIndex: index})
  }

  onEnter = () => {
    if (this._lastSearch === this._text) {
      this.onUp()
    } else {
      this.submitSearch()
    }
  }

  onUp = () => {
    if (this.state.selectedIndex >= this.props.hits.length - 1) {
      this.selectResult(0)
      return
    }
    this.selectResult(this.state.selectedIndex + 1)
  }

  onDown = () => {
    if (this.state.selectedIndex <= 0) {
      this.selectResult(this.props.hits.length - 1)
      return
    }
    this.selectResult(this.state.selectedIndex - 1)
  }

  onChangedText = (text: string) => {
    this._text = text
  }

  inProgress = () => {
    return this.props.status === 'inprogress'
  }

  hasResults = () => {
    return this.props.status === 'done' || this.props.hits.length > 0
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.hits.length === 0 && this.props.hits.length > 0) {
      this.selectResult(0)
    }
  }
}

export class ThreadSearchDesktop extends ThreadSearchBase {
  _onKeydown = e => {
    switch (e.key) {
      case 'Escape':
        this.props.selfHide()
        break
      case 'g':
        if (e.ctrlKey || e.metaKey) {
          if (e.shiftKey) {
            this.onDown()
          } else {
            this.onUp()
          }
        }
        break
      case 'ArrowUp':
        this.onUp()
        break
      case 'ArrowDown':
        this.onDown()
        break
      case 'Enter':
        if (e.shiftKey) {
          this.onDown()
        }
        break
    }
  }

  _renderHit = (index, item) => {
    return (
      <Kb.ClickableBox
        key={index}
        onClick={() => {
          this.props.loadSearchHit(index)
          this.setState({selectedIndex: index})
        }}
        style={styles.hitRow}
      >
        <Kb.Avatar username={item.author} size={24} />
        <Kb.Text type="Body" style={styles.hitSummary}>
          {item.summary}
        </Kb.Text>
        <Kb.Text type="BodySmall" style={styles.time}>
          {formatTimeForMessages(item.timestamp)}
        </Kb.Text>
      </Kb.ClickableBox>
    )
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} style={this.props.style}>
        <Kb.Box2 direction="horizontal" style={styles.outerContainer} fullWidth={true} gap="tiny">
          <Kb.Box2 direction="horizontal" style={styles.inputContainer}>
            <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.queryContainer} centerChildren={true}>
              <Kb.Icon type="iconfont-search" color={Styles.globalColors.black_50} fontSize={16} />
              <Kb.PlainInput
                autoFocus={true}
                flexable={true}
                onChangeText={this.onChangedText}
                onEnterKeyDown={this.onEnter}
                onKeyDown={this._onKeydown}
                placeholder="Search..."
              />
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" gap="tiny" style={styles.resultsContainer}>
              {this.inProgress() && <Kb.ProgressIndicator style={styles.progress} />}
              {this.hasResults() && (
                <Kb.Box2 direction="horizontal" gap="tiny">
                  <Kb.Text type="BodySmall" style={styles.results}>
                    {this.props.status === 'done' && this.props.hits.length === 0
                      ? 'No results'
                      : `${this.state.selectedIndex + 1} of ${this.props.hits.length}`}
                  </Kb.Text>
                  <Kb.Icon
                    color={Styles.globalColors.black_50}
                    fontSize={arrowSize}
                    onClick={this.onUp}
                    type="iconfont-arrow-up"
                  />
                  <Kb.Icon
                    color={Styles.globalColors.black_50}
                    fontSize={arrowSize}
                    onClick={this.onDown}
                    type="iconfont-arrow-down"
                  />
                </Kb.Box2>
              )}
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Button type="Primary" disabled={this.inProgress()} onClick={this.submitSearch} label="Search" />
          <Kb.Button type="Secondary" onClick={this.props.onCancel} label="Cancel" />
        </Kb.Box2>
        {this.props.hits.length > 0 && (
          <Kb.List2
            indexAsKey={true}
            items={this.props.hits}
            itemHeight={{height: hitHeight, type: 'fixed'}}
            renderItem={this._renderHit}
            style={styles.hitList}
          />
        )}
      </Kb.Box2>
    )
  }
}

export class ThreadSearchMobile extends ThreadSearchBase {
  render() {
    return (
      <Kb.Box2 direction="horizontal" style={this.props.style}>
        <Kb.Box2 direction="horizontal" style={styles.outerContainer} gap="tiny">
          <Kb.Box2 direction="horizontal" gap="xtiny">
            <Kb.Icon
              color={this.props.hits.length > 0 ? Styles.globalColors.blue : Styles.globalColors.black_50}
              fontSize={arrowSize}
              onClick={this.onUp}
              type="iconfont-arrow-up"
            />
            <Kb.Icon
              color={this.props.hits.length > 0 ? Styles.globalColors.blue : Styles.globalColors.black_50}
              fontSize={arrowSize}
              onClick={this.onDown}
              type="iconfont-arrow-down"
            />
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" style={styles.inputContainer}>
            <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.queryContainer} centerChildren={true}>
              <Kb.Icon type="iconfont-search" color={Styles.globalColors.black_50} fontSize={16} />
              <Kb.PlainInput
                autoFocus={true}
                flexable={true}
                onChangeText={this.onChangedText}
                onEnterKeyDown={this.onEnter}
                placeholder="Search..."
                returnKeyType="search"
              />
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" gap="tiny" style={styles.resultsContainer}>
              {this.inProgress() && <Kb.ProgressIndicator style={styles.progress} />}
              {this.hasResults() && (
                <Kb.Box2 direction="horizontal" gap="tiny">
                  <Kb.Text type="BodySmall" style={styles.results}>
                    {this.props.status === 'done' && this.props.hits.length === 0
                      ? 'No results'
                      : `${this.state.selectedIndex + 1} of ${this.props.hits.length}`}
                  </Kb.Text>
                </Kb.Box2>
              )}
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.doneContainer}>
            <Kb.Text type="BodySemibold" style={styles.done} onClick={this.props.onCancel}>
              Done
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  done: {
    color: Styles.globalColors.blue,
  },
  doneContainer: {
    flexShrink: 0,
  },
  hitList: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.blue5,
      borderBottom: '1px solid',
      borderColor: Styles.globalColors.black_20,
      height: 4 * hitHeight,
    },
  }),
  hitRow: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: hitHeight,
    justifyContent: 'space-between',
    padding: Styles.globalMargins.tiny,
  },
  hitSummary: Styles.platformStyles({
    isElectron: {
      display: 'inline',
      flex: 1,
      marginLeft: Styles.globalMargins.tiny,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
  inputContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      borderColor: Styles.globalColors.black_20,
      borderRadius: Styles.borderRadius,
      borderStyle: 'solid',
      borderWidth: 1,
      flex: 1,
      justifyContent: 'space-between',
    },
    isElectron: {
      paddingBottom: Styles.globalMargins.xtiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.xtiny,
    },
    isMobile: {
      padding: Styles.globalMargins.tiny,
    },
  }),
  outerContainer: {
    backgroundColor: Styles.globalColors.blue5,
    justifyContent: 'space-between',
    padding: Styles.globalMargins.tiny,
  },
  progress: {
    height: 14,
  },
  queryContainer: {
    flex: 1,
  },
  results: {
    color: Styles.globalColors.black_40,
  },
  resultsContainer: {
    flexShrink: 0,
  },
  time: {
    flexShrink: 0,
  },
})
