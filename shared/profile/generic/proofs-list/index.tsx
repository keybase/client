import * as React from 'react'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {SiteIcon} from '../shared'
import {makeInsertMatcher} from '@/util/string'

export type IdentityProvider = {
  name: string
  desc: string
  icon: T.Tracker.SiteIconSet
  key: string
  new: boolean
}

export type Props = {
  onCancel: () => void
  providerClicked: (key: string) => void
  providers: Array<IdentityProvider>
  title: string
}

type ProvidersProps = {
  filter: string
} & Props

class Providers extends React.Component<ProvidersProps> {
  static _itemHeight = {
    height: Kb.Styles.isMobile ? 56 : 48,
    type: 'fixed',
  } as const
  _renderItem = (_: unknown, provider: IdentityProvider) => (
    <React.Fragment key={provider.name}>
      <Kb.Divider />
      <Kb.ClickableBox
        className="hover_background_color_blueLighter2"
        onClick={() => this.props.providerClicked(provider.key)}
        style={styles.containerBox}
      >
        <SiteIcon set={provider.icon} style={styles.icon} full={true} />
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="BodySemibold" style={styles.title}>
            {provider.name}
          </Kb.Text>
          {(provider.new || !!provider.desc) && (
            <Kb.Box2 direction="horizontal" alignItems="flex-start" fullWidth={true}>
              {provider.new && (
                <Kb.Meta title="NEW" backgroundColor={Kb.Styles.globalColors.blue} style={styles.new} />
              )}
              <Kb.Text type="BodySmall" style={styles.description}>
                {provider.desc}
              </Kb.Text>
            </Kb.Box2>
          )}
        </Kb.Box2>
        <Kb.Icon
          type="iconfont-arrow-right"
          color={Kb.Styles.globalColors.black_50}
          fontSize={Kb.Styles.isMobile ? 20 : 16}
          style={styles.iconArrow}
        />
      </Kb.ClickableBox>
    </React.Fragment>
  )
  render() {
    const filterRegexp = makeInsertMatcher(this.props.filter)

    const exact: Array<IdentityProvider> = []
    const inexact: Array<IdentityProvider> = []
    this.props.providers.forEach(p => {
      if (p.name === this.props.filter) {
        exact.push(p)
      } else if (filterProvider(p, filterRegexp)) {
        inexact.push(p)
      }
    })

    const items = [...exact, ...inexact]
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.flexOne}>
          <Kb.List2 items={items} renderItem={this._renderItem} itemHeight={Providers._itemHeight} />
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const normalizeForFiltering = (input: string) => input.toLowerCase().replace(/[.\s]/g, '')

const filterProvider = (p: IdentityProvider, filter: RegExp) =>
  normalizeForFiltering(p.name).search(filter) !== -1 || normalizeForFiltering(p.desc).search(filter) !== -1

type State = {
  filter: string
}

class ProofsList extends React.Component<Props, State> {
  state = {filter: ''}
  _onSetFilter = (filter: string) => this.setState({filter})
  render() {
    return (
      <Kb.PopupWrapper onCancel={this.props.onCancel}>
        <Kb.Box style={styles.mobileFlex}>
          <Kb.Box2 direction="vertical" style={styles.container}>
            {!Kb.Styles.isMobile && (
              <Kb.Text center={true} type="Header" style={styles.header}>
                Prove your...
              </Kb.Text>
            )}
            <Kb.Box style={styles.inputContainer}>
              <Kb.Icon
                type="iconfont-search"
                color={Kb.Styles.globalColors.black_50}
                fontSize={Kb.Styles.isMobile ? 20 : 16}
              />
              <Kb.PlainInput
                autoFocus={true}
                placeholder={`Search ${this.props.providers.length} platforms`}
                flexable={true}
                multiline={false}
                onChangeText={this._onSetFilter}
                type="text"
                style={styles.text}
                value={this.state.filter}
              />
            </Kb.Box>
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.listContainer}>
              <Providers {...this.props} filter={this.state.filter} />
              <Kb.Divider />
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box>
      </Kb.PopupWrapper>
    )
  }
}

const rightColumnStyle = Kb.Styles.platformStyles({
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          borderRadius: 4,
          height: 485,
          overflow: 'hidden',
          width: 560,
        },
        isMobile: {
          flex: 1,
          width: '100%',
        },
      }),
      containerBox: {
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row',
        height: Kb.Styles.isMobile ? 56 : 48,
        justifyContent: 'flex-start',
      },
      description: {
        ...rightColumnStyle,
      },
      flexOne: {
        flex: 1,
      },
      footer: {
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        padding: Kb.Styles.globalMargins.xsmall,
      },
      footerText: {
        ...rightColumnStyle,
        color: Kb.Styles.globalColors.black_50,
        marginLeft: Kb.Styles.globalMargins.tiny,
      },
      header: {
        color: Kb.Styles.globalColors.black,
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      icon: {
        height: 32,
        marginLeft: Kb.Styles.globalMargins.small,
        marginRight: Kb.Styles.globalMargins.small,
        width: 32,
      },
      iconArrow: {
        marginRight: Kb.Styles.globalMargins.small,
      },
      inputContainer: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        marginBottom: Kb.Styles.globalMargins.xsmall,
        marginLeft: Kb.Styles.globalMargins.small,
        marginRight: Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.xsmall,
        padding: Kb.Styles.globalMargins.tiny,
      },
      listContainer: Kb.Styles.platformStyles({
        common: {
          flex: 1,
        },
        isElectron: {
          maxHeight: 560 - 48,
        },
      }),
      mobileFlex: Kb.Styles.platformStyles({
        isMobile: {flex: 1},
      }),
      new: {
        marginRight: Kb.Styles.globalMargins.xtiny,
        marginTop: 1,
      },
      text: {
        backgroundColor: Kb.Styles.globalColors.transparent,
        color: Kb.Styles.globalColors.black_50,
        marginLeft: Kb.Styles.globalMargins.tiny,
        marginRight: Kb.Styles.globalMargins.tiny,
      },
      title: {
        ...rightColumnStyle,
        color: Kb.Styles.globalColors.black,
      },
    }) as const
)

export default ProofsList
