// @flow

import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {formatTimeForMessages} from '../../../util/timestamp'

const hitHeight = 30

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

const ThreadSearch = ThreadSearcher => {
  return class extends React.Component<Props, State> {
    state = {selectedIndex: 0}
    _text: string
    _lastSearch: string

    _submitSearch = () => {
      this._lastSearch = this._text
      this.setState({selectedIndex: 0})
      this.props.onSearch(this._text)
    }

    _selectResult = (index: number) => {
      this.props.loadSearchHit(index)
      this.setState({selectedIndex: index})
    }

    _onEnter = () => {
      if (this._lastSearch === this._text) {
        this._onUp()
      } else {
        this._submitSearch()
      }
    }

    _onUp = () => {
      if (this.state.selectedIndex >= this.props.hits.length - 1) {
        this._selectResult(0)
        return
      }
      this._selectResult(this.state.selectedIndex + 1)
    }

    _onDown = () => {
      if (this.state.selectedIndex <= 0) {
        this._selectResult(this.props.hits.length - 1)
        return
      }
      this._selectResult(this.state.selectedIndex - 1)
    }

    _onChangedText = (text: string) => {
      this._text = text
    }

    _inProgress = () => {
      return this.props.status === 'inprogress'
    }

    _hasResults = () => {
      return this.props.status === 'done' || this.props.hits.length > 0
    }

    componentDidUpdate(prevProps: Props) {
      if (prevProps.hits.length === 0 && this.props.hits.length > 0) {
        this._selectResult(0)
      }
    }

    render() {
      return (
        <ThreadSearcher
          {...this.props}
          submitSearch={this._submitSearch}
          selectResult={this._selectResult}
          selectedIndex={this.state.selectedIndex}
          onEnter={this._onEnter}
          onUp={this._onUp}
          onDown={this._onDown}
          onChangedText={this._onChangedText}
          inProgress={this._inProgress}
          hasResults={this._hasResults}
        />
      )
    }
  }
}

type SearchProps = {
  submitSearch: () => void,
  selectResult: number => void,
  onEnter: () => void,
  onUp: () => void,
  onDown: () => void,
  onChangedText: string => void,
  inProgress: () => boolean,
  hasResults: () => boolean,
  selectedIndex: number,
}

class ThreadSearchDesktop extends React.Component<SearchProps & Props> {
  _onKeydown = e => {
    switch (e.key) {
      case 'Escape':
        this.props.selfHide()
        break
      case 'g':
        if (e.ctrlKey || e.metaKey) {
          if (e.shiftKey) {
            this.props.onDown()
          } else {
            this.props.onUp()
          }
        }
        break
      case 'ArrowUp':
        this.props.onUp()
        break
      case 'ArrowDown':
        this.props.onDown()
        break
      case 'Enter':
        if (e.shiftKey) {
          this.props.onDown()
        }
        break
    }
  }

  _renderHit = (index, item) => {
    return (
      <Kb.ClickableBox key={index} onClick={() => this.props.selectResult(index)} style={styles.hitRow}>
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
              <Kb.Icon type="iconfont-search" color={Styles.globalColors.black_50} />
              <Kb.PlainInput
                autoFocus={true}
                flexable={true}
                onChangeText={this.props.onChangedText}
                onEnterKeyDown={this.props.onEnter}
                onKeyDown={this._onKeydown}
                placeholder="Search..."
              />
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" gap="tiny" style={styles.resultsContainer}>
              {this.props.inProgress() && <Kb.ProgressIndicator style={styles.progress} />}
              {this.props.hasResults() && (
                <Kb.Box2 direction="horizontal" gap="tiny">
                  <Kb.Text type="BodySmall" style={styles.results}>
                    {this.props.status === 'done' && this.props.hits.length === 0
                      ? 'No results'
                      : `${this.props.selectedIndex + 1} of ${this.props.hits.length}`}
                  </Kb.Text>
                  <Kb.Icon
                    color={Styles.globalColors.black_50}
                    onClick={this.props.onUp}
                    type="iconfont-arrow-up"
                  />
                  <Kb.Icon
                    color={Styles.globalColors.black_50}
                    onClick={this.props.onDown}
                    type="iconfont-arrow-down"
                  />
                </Kb.Box2>
              )}
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Button
            type="Primary"
            disabled={this.props.inProgress()}
            onClick={this.props.submitSearch}
            label="Search"
          />
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

class ThreadSearchMobile extends React.Component<SearchProps & Props> {
  render() {
    return (
      <Kb.Box2 direction="horizontal" style={this.props.style}>
        <Kb.Box2 direction="horizontal" style={styles.outerContainer} gap="tiny">
          <Kb.Box2 direction="horizontal" gap="tiny">
            <Kb.Icon
              color={this.props.hits.length > 0 ? Styles.globalColors.blue : Styles.globalColors.black_50}
              onClick={this.props.onUp}
              type="iconfont-arrow-up"
            />
            <Kb.Icon
              color={this.props.hits.length > 0 ? Styles.globalColors.blue : Styles.globalColors.black_50}
              onClick={this.props.onDown}
              type="iconfont-arrow-down"
            />
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" style={styles.inputContainer}>
            <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.queryContainer} centerChildren={true}>
              <Kb.Icon type="iconfont-search" color={Styles.globalColors.black_50} />
              <Kb.PlainInput
                autoFocus={true}
                flexable={true}
                onChangeText={this.props.onChangedText}
                onEnterKeyDown={this.props.onEnter}
                placeholder="Search..."
                returnKeyType="search"
              />
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" gap="tiny" style={styles.resultsContainer}>
              {this.props.inProgress() && <Kb.ProgressIndicator style={styles.progress} />}
              {this.props.hasResults() && (
                <Kb.Box2 direction="horizontal" gap="tiny">
                  <Kb.Text type="BodySmall" style={styles.results}>
                    {this.props.status === 'done' && this.props.hits.length === 0
                      ? 'No results'
                      : `${this.props.selectedIndex + 1} of ${this.props.hits.length}`}
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

export default ThreadSearch(Styles.isMobile ? ThreadSearchMobile : ThreadSearchDesktop)

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
