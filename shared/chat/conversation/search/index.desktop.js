// @flow

import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type {Props} from './index.types'

const hitHeight = 30

type State = {|
  selectedIndex: number,
|}

class ThreadSearch extends React.Component<Props, State> {
  state = {selectedIndex: 0}
  _inputRef = React.createRef()
  _submitSearch = () => {
    this.setState({selectedIndex: 0})
    this._inputRef.current && this.props.onSearch(this._inputRef.current.getValue())
  }
  _onUp = () => {
    if (this.state.selectedIndex >= this.props.hits.length) {
      return
    }
    this.props.loadSearchHit(this.state.selectedIndex)
    this.setState({selectedIndex: this.state.selectedIndex + 1})
  }
  _onDown = () => {
    if (this.state.selectedIndex <= 0) {
      return
    }
    this.props.loadSearchHit(this.state.selectedIndex)
    this.setState({selectedIndex: this.state.selectedIndex - 1})
  }
  _renderHit = (index, item) => {
    return (
      <Kb.ClickableBox key={index} onClick={() => this.props.loadSearchHit(index)} style={styles.hitRow}>
        <Kb.Avatar username={item.author} size={24} />
        <Kb.Text type="BodySmall" style={styles.hitSummary}>
          {item.summary}
        </Kb.Text>
      </Kb.ClickableBox>
    )
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={this.props.style}>
        <Kb.Box2 direction="horizontal" style={styles.outerContainer} fullWidth={true} gap="tiny">
          <Kb.Box2 direction="horizontal" style={styles.inputContainer} fullWidth={true}>
            <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} centerChildren={true}>
              <Kb.Icon type="iconfont-search" color={Styles.globalColors.black_50} fontSize={16} />
              <Kb.Input
                autoFocus={true}
                hideUnderline={true}
                hintText="Search..."
                small={true}
                uncontrolled={true}
                onEnterKeyDown={this._submitSearch}
                ref={this._inputRef}
              />
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" gap="tiny" style={styles.resultsContainer}>
              {this.props.inProgress && <Kb.ProgressIndicator style={styles.progress} />}
              {this.props.hits.length > 0 && (
                <Kb.Box2 direction="horizontal" gap="tiny">
                  <Kb.Text type="BodySmall" style={styles.results}>
                    {this.state.selectedIndex} of {this.props.hits.length}
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
          <Kb.Button
            type="Secondary"
            disabled={!this.props.inProgress}
            onClick={this.props.onCancel}
            label="Cancel"
          />
        </Kb.Box2>
        {this.props.hits.length > 0 && (
          <Kb.ScrollView style={styles.hitList}>
            {this.props.hits.map((h, i) => {
              return this._renderHit(i, h)
            })}
          </Kb.ScrollView>
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  hit: {
    height: hitHeight,
  },
  hitList: {
    backgroundColor: Styles.globalColors.blue5,
    maxHeight: 150,
  },
  hitRow: {
    ...Styles.globalStyles.flexBoxRow,
  },
  hitSummary: {
    marginLeft: Styles.globalMargins.tiny,
  },
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
})

export default ThreadSearch
