// @flow

import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {formatTimeForMessages} from '../../../util/timestamp'
import type {Props} from './index.types'

const hitHeight = 30

type State = {|
  selectedIndex: number,
  showResultList: boolean,
|}

class ThreadSearch extends React.Component<Props, State> {
  state = {selectedIndex: 0, showResultList: false}
  _text: string

  _submitSearch = () => {
    this.setState({selectedIndex: 0})
    this.props.onSearch(this._text)
  }

  _onUp = () => {
    if (this.state.selectedIndex >= this.props.hits.length - 1) {
      return
    }
    this.props.loadSearchHit(this.state.selectedIndex + 1)
    this.setState({selectedIndex: this.state.selectedIndex + 1})
  }

  _onDown = () => {
    if (this.state.selectedIndex <= 0) {
      return
    }
    this.props.loadSearchHit(this.state.selectedIndex - 1)
    this.setState({selectedIndex: this.state.selectedIndex - 1})
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

  _onChangedText = (text: string) => {
    this._text = text
  }

  _onFocus = () => {
    this.setState({showResultList: true})
  }

  _onBlur = () => {
    setTimeout(() => this.setState({showResultList: false}), 300)
  }

  _onKeydown = e => {
    if (e.key === 'Escape') {
      this.props.selfHide()
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.hits.length === 0 && this.props.hits.length > 0) {
      this.props.loadSearchHit(0)
      this.setState({selectedIndex: 0})
    }
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} style={this.props.style}>
        <Kb.Box2 direction="horizontal" style={styles.outerContainer} fullWidth={true} gap="tiny">
          <Kb.Box2 direction="horizontal" style={styles.inputContainer} fullWidth={true}>
            <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} centerChildren={true}>
              <Kb.Icon type="iconfont-search" color={Styles.globalColors.black_50} fontSize={16} />
              <Kb.PlainInput
                autoFocus={true}
                flexable={true}
                onBlur={this._onBlur}
                onChangeText={this._onChangedText}
                onEnterKeyDown={this._submitSearch}
                onFocus={this._onFocus}
                onKeyDown={this._onKeydown}
                placeholder="Search..."
              />
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" gap="tiny" style={styles.resultsContainer}>
              {this.props.inProgress && <Kb.ProgressIndicator style={styles.progress} />}
              {this.props.hits.length > 0 && (
                <Kb.Box2 direction="horizontal" gap="tiny">
                  <Kb.Text type="BodySmall" style={styles.results}>
                    {this.state.selectedIndex + 1} of {this.props.hits.length}
                  </Kb.Text>
                  <Kb.Icon
                    color={Styles.globalColors.black_50}
                    fontSize={16}
                    onClick={this._onUp}
                    type="iconfont-arrow-up"
                  />
                  <Kb.Icon
                    color={Styles.globalColors.black_50}
                    fontSize={16}
                    onClick={this._onDown}
                    type="iconfont-arrow-down"
                  />
                </Kb.Box2>
              )}
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Button
            type="Primary"
            disabled={this.props.inProgress}
            onClick={this._submitSearch}
            label="Search"
          />
          <Kb.Button type="Secondary" onClick={this.props.onCancel} label="Cancel" />
        </Kb.Box2>
        {this.props.hits.length > 0 && this.state.showResultList && (
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

const styles = Styles.styleSheetCreate({
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
  inputContainer: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_20,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    justifyContent: 'space-between',
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
  outerContainer: {
    backgroundColor: Styles.globalColors.blue5,
    padding: Styles.globalMargins.tiny,
  },
  progress: {
    height: 14,
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

export default ThreadSearch
