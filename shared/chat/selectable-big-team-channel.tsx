import * as React from 'react'
import * as Kb from '@/common-adapters'
import {TeamAvatar} from './avatars'
import {pluralize} from '@/util/string'
import {BottomLine} from './inbox/row/small-team/bottom-line'
import type * as T from '@/constants/types'
import {SnippetContext} from './inbox/row/small-team/contexts'

type Props = {
  isSelected: boolean
  numSearchHits?: number
  maxSearchHits?: number
  teamname: string
  channelname: string
  onSelectConversation: () => void
  showBadge: boolean
  showBold: boolean
  snippet?: string
  snippetDecoration: T.RPCChat.SnippetDecoration
}

type State = {
  isHovered: boolean
}

class SelectableBigTeamChannel extends React.PureComponent<Props, State> {
  state = {
    isHovered: false,
  }

  _onMouseLeave = () => this.setState({isHovered: false})
  _onMouseOver = () => this.setState({isHovered: true})
  _getSearchHits = () => {
    if (!this.props.numSearchHits) {
      return ''
    }
    if (this.props.maxSearchHits) {
      return this.props.numSearchHits >= this.props.maxSearchHits
        ? `${this.props.numSearchHits}+`
        : `${this.props.numSearchHits}`
    }
    return `${this.props.numSearchHits}`
  }

  render() {
    const boldOverride = this.props.showBold ? Kb.Styles.globalStyles.fontBold : null
    const rowLoadedContent = (
      <>
        <TeamAvatar
          teamname={this.props.teamname}
          isMuted={false}
          isSelected={false}
          isHovered={this.state.isHovered}
        />
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.textContainer}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.Text
              type="BodySemibold"
              style={Kb.Styles.collapseStyles([
                styles.teamname,
                {color: this.props.isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black},
              ])}
              title={this.props.teamname}
              lineClamp={Kb.Styles.isMobile ? 1 : undefined}
              ellipsizeMode="tail"
            >
              {this.props.teamname}
            </Kb.Text>
            <Kb.Text
              type="BodySemibold"
              style={Kb.Styles.collapseStyles([
                boldOverride,
                styles.channelname,
                {color: this.props.isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black},
              ])}
              title={`#${this.props.channelname}`}
              lineClamp={Kb.Styles.isMobile ? 1 : undefined}
              ellipsizeMode="tail"
            >
              &nbsp;#
              {this.props.channelname}
            </Kb.Text>
          </Kb.Box2>
          {!this.props.numSearchHits && (
            <SnippetContext.Provider value={this.props.snippet ?? ''}>
              <BottomLine isSelected={this.props.isSelected} allowBold={false} />
            </SnippetContext.Provider>
          )}
          {!!this.props.numSearchHits && (
            <Kb.Text
              type="BodySmall"
              style={Kb.Styles.collapseStyles([this.props.isSelected && styles.selectedText])}
            >
              {this._getSearchHits()} {pluralize('result', this.props.numSearchHits)}
            </Kb.Text>
          )}
        </Kb.Box2>
        {this.props.showBadge && <Kb.Box2 direction="horizontal" style={styles.badge} />}
      </>
    )
    return (
      <Kb.ClickableBox onClick={this.props.onSelectConversation}>
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          centerChildren={true}
          className="hover_background_color_blueGreyDark"
          style={Kb.Styles.collapseStyles([
            styles.filteredRow,
            {
              backgroundColor: this.props.isSelected
                ? Kb.Styles.globalColors.blue
                : Kb.Styles.globalColors.white,
            },
          ])}
          onMouseLeave={this._onMouseLeave}
          onMouseOver={this._onMouseOver}
        >
          {this.props.teamname ? rowLoadedContent : <Kb.ProgressIndicator type="Small" />}
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }
}

const rowHeight = Kb.Styles.isMobile ? 64 : 56

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      badge: {
        backgroundColor: Kb.Styles.globalColors.orange,
        borderRadius: 6,
        flexShrink: 0,
        height: Kb.Styles.globalMargins.tiny,
        width: Kb.Styles.globalMargins.tiny,
      },
      channelname: Kb.Styles.platformStyles({
        // TODO: tweak this so that they take up full space in popup
        common: {
          flexShrink: 0,
          maxWidth: '70%',
        },
        isElectron: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      filteredRow: Kb.Styles.platformStyles({
        common: {
          height: rowHeight,
        },
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.xsmall,
        },
        isMobile: {
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
        },
      }),
      selectedText: {
        color: Kb.Styles.globalColors.white,
      },
      teamname: Kb.Styles.platformStyles({
        common: {
          color: Kb.Styles.globalColors.black,
          flexShrink: 1,
        },
        isElectron: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      }),
      textContainer: {
        flexShrink: 1,
        overflow: 'hidden',
        paddingRight: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default SelectableBigTeamChannel
