// @flow
import {namedConnect} from '../../util/container'
import * as Platforms from '../../constants/platform'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as FsGen from '../../actions/fs-gen'
import * as Styles from '../../styles'
import * as React from 'react'
import {debounce} from 'lodash-es'
import flags from '../../util/feature-flags'

type Props = {|
  onUpdate: string => void,
  path: Types.Path,
  style?: ?Styles.StylesCrossPlatform,
|}

type State = {|
  editing: boolean,
  filter: string,
|}

const KeyHandler = (Platforms.isMobile ? c => c : require('../../util/key-handler.desktop').default)(
  () => null
)

class FolderViewFilter extends React.PureComponent<Props, State> {
  state = {
    editing: false,
    filter: '',
  }

  _update = text => {
    this.setState({filter: text})
    this.props.onUpdate(text)
  }

  _input = React.createRef()

  _onBlur = () => this.setState({editing: false})
  _onFocus = () => this.setState({editing: true})

  _focus = () => {
    this._input.current && this._input.current.focus()
  }
  _blur = () => this._input.current && this._input.current.blur()

  _onHotkey = (cmd: string) => {
    cmd.endsWith('+f') && this._focus()
  }
  _onKeyDown = (e: SyntheticKeyboardEvent<>, isComposingIME: boolean) => {
    if (e.key === 'Escape' && !isComposingIME) {
      this._blur()
      this._update('')
    }
  }

  // Clear the filter if path changes, or if we get unmounted.
  componentDidUpdate(prevProps) {
    prevProps.path !== this.props.path && this._update('')
  }
  componentWillUnmount() {
    this.props.onUpdate('')
  }

  render() {
    return (
      Types.getPathLevel(this.props.path) > 1 && (
        <Kb.ClickableBox onClick={this._focus}>
          <KeyHandler onHotkey={this._onHotkey} hotkeys={[Platforms.isDarwin ? 'command+f' : 'ctrl+f']} />
          <Kb.Box2
            direction="horizontal"
            style={Styles.collapseStyles([
              styles.container,
              !this.state.editing && styles.dark,
              this.props.style,
            ])}
            centerChildren={true}
            gap="tiny"
            gapStart={true}
            gapEnd={true}
          >
            <Kb.NewInput
              icon="iconfont-search"
              hideBorder={true}
              value={this.state.filter}
              placeholder="Filter ..."
              onChangeText={this._update}
              onBlur={this._onBlur}
              onFocus={this._onFocus}
              onKeyDown={this._onKeyDown}
              ref={this._input}
              style={styles.input}
              containerStyle={styles.input}
            />
            <Kb.Text
              type="BodySemibold"
              style={Styles.collapseStyles([styles.shortcutText, this.state.editing && styles.hidden])}
            >
              ({Platforms.shortcutSymbol}F)
            </Kb.Text>
          </Kb.Box2>
        </Kb.ClickableBox>
      )
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    borderRadius: Styles.borderRadius,
    padding: Styles.globalMargins.xxtiny,
  },
  dark: {
    backgroundColor: Styles.globalColors.black_10,
  },
  hidden: {
    opacity: 0,
  },
  input: {
    backgroundColor: Styles.globalColors.transparent,
  },
  shortcutText: {
    color: Styles.globalColors.black_35,
  },
})

type OwnProps = {|
  path: Types.Path,
  style?: ?Styles.StylesCrossPlatform,
|}

const mapStateToProps = state => ({})
const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  _onUpdate: (newFilter: string) => dispatch(FsGen.createSetFolderViewFilter({filter: newFilter})),
})

const mergeProps = (s, d, o) => ({
  onUpdate: debounce(d._onUpdate, 100),
  path: o.path,
  style: o.style,
})

export default (Platforms.isMobile || !flags.folderViewFilter
  ? () => null
  : namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'FolderViewFilter')(
      FolderViewFilter
    ))
