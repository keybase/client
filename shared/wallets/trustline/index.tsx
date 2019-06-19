import * as I from 'immutable'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import {memoize} from '../../util/memoize'
import Asset from './asset-container'

type _Props = {
  accountID: Types.AccountID
  acceptedAssets: I.Map<Types.AssetID, number>
  balanceAvailableToSend: number
  clearTrustlineModal: () => void
  errorMessage?: string
  loaded: boolean
  onSearchChange: (text: string) => void
  popularAssets: I.List<Types.AssetID>
  refresh: () => void
  searchingAssets?: I.List<Types.AssetID>
  totalAssetsCount?: number
  waitingSearch: boolean
}

type BodyProps = _Props & {onFocusChange?: (focused: boolean) => void}

type Props = _Props & {
  onDone: () => void
}

const makeSections = (props: BodyProps) => [
  ...(props.searchingAssets
    ? [
        {
          data: props.searchingAssets.toArray(),
          key: 'section-search',
          keyExtractor: item => `search-item:${item}`,
          title: '',
        },
      ]
    : []),
  ...(!props.searchingAssets && props.acceptedAssets.size
    ? [
        {
          data: props.acceptedAssets.keySeq().toArray(),
          key: 'section-accepted',
          keyExtractor: item => `accepted-item:${item}`,
          title: 'Accepted assets',
        },
      ]
    : []),
  ...(!props.searchingAssets && props.popularAssets.size
    ? [
        {
          data: props.popularAssets.toArray(),
          key: 'section-popular',
          keyExtractor: item => `popular-item:${item}`,
          title: 'Popular assets',
        },
      ]
    : []),
]

const sectionHeader = section =>
  !section.title || (
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.sectionHeader}>
      <Kb.Text type="BodySmall">{section.title}</Kb.Text>
    </Kb.Box2>
  )

const haveEnoughBalanceToAccept = memoize(
  (props: BodyProps) => props.balanceAvailableToSend >= Constants.trustlineHoldingBalance
)

const getContent = (props: BodyProps) =>
  props.searchingAssets && !props.searchingAssets.size ? (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.grow} centerChildren={true}>
      <Kb.Text type="BodySmall">No asset is found.</Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.SectionList
      // hack around the bug where when we change from search mode where
      // there's no section header, into normal mode where there are
      // section headers, first section header doesn't show.
      key={props.searchingAssets ? 'search-section-list' : 'non-search-section-list'}
      sections={makeSections(props)}
      renderItem={({index, item}) => (
        <Asset
          accountID={props.accountID}
          firstItem={index === 0}
          assetID={item}
          disabled={!haveEnoughBalanceToAccept(props)}
        />
      )}
      renderSectionHeader={({section}) => sectionHeader(section)}
    />
  )

const Body = (props: BodyProps) => {
  React.useEffect(() => props.refresh(), [])
  React.useEffect(() => () => props.clearTrustlineModal(), [])
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.body}>
      {props.loaded ? (
        <>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.searchFilter}>
            <Kb.SearchFilter
              icon="iconfont-search"
              fullWidth={true}
              placeholderText={`Search ${props.totalAssetsCount || 'thousands of'} assets`}
              hotkey="f"
              onChange={props.onSearchChange}
              onFocus={props.onFocusChange && (() => props.onFocusChange(true))}
              onBlur={props.onFocusChange && (() => props.onFocusChange(false))}
              waiting={props.waitingSearch}
            />
          </Kb.Box2>
          <Kb.Divider />
          {!haveEnoughBalanceToAccept(props) && (
            <Kb.Banner
              color="red"
              text={`Stellar holds ${
                Constants.trustlineHoldingBalance
              } XLM per trustline, and your available Lumens balance is ${props.balanceAvailableToSend} XLM.`}
            />
          )}
          {getContent(props)}
        </>
      ) : (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.grow} centerChildren={true}>
          <Kb.ProgressIndicator />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const TrustlineDesktop = (props: Props) => {
  const {onDone, ...rest} = props
  const [searchFilterFocused, setSearchFilterFocused] = React.useState(false)
  return (
    <Kb.PopupDialog onClose={onDone} immuneToEscape={searchFilterFocused}>
      <Kb.Box2 direction="vertical" style={styles.containerDesktop}>
        <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.headerDesktop}>
          <Kb.Text type="Header">Trustlines</Kb.Text>
        </Kb.Box2>
        <Body {...rest} onFocusChange={setSearchFilterFocused} />
        <Kb.Divider />
        <Kb.Button
          type="Default"
          mode="Primary"
          label="Done"
          onClick={props.onDone}
          style={styles.doneButtonDesktop}
        />
      </Kb.Box2>
    </Kb.PopupDialog>
  )
}

const TrustlineMobile = Kb.HeaderHoc<BodyProps>(Body)

const Trustline = Styles.isMobile
  ? (props: Props) => {
      const {onDone, ...rest} = props
      const bodyProps = rest as BodyProps
      return (
        <TrustlineMobile
          borderless={true}
          title="Trustlines"
          rightActionLabel="Done"
          onRightAction={props.onDone}
          {...bodyProps}
        />
      )
    }
  : TrustlineDesktop

export default Trustline

const styles = Styles.styleSheetCreate({
  body: {
    ...Styles.globalStyles.flexGrow,
  },
  containerDesktop: {
    backgroundColor: Styles.globalColors.white,
    borderRadius: Styles.borderRadius,
    height: 560,
    width: 400,
  },
  doneButtonDesktop: {
    marginBottom: Styles.globalMargins.xsmall,
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.xsmall,
  },
  grow: {
    ...Styles.globalStyles.flexGrow,
  },
  headerDesktop: {
    flexShrink: 0,
    height: 48,
  },
  searchFilter: Styles.platformStyles({
    common: {
      flexShrink: 0,
    },
    isElectron: {
      padding: Styles.globalMargins.tiny,
    },
  }),
  sectionHeader: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueGrey,
      paddingLeft: Styles.globalMargins.tiny,
    },
    isElectron: {
      height: Styles.globalMargins.mediumLarge,
    },
    isMobile: {
      height: Styles.globalMargins.large,
    },
  }),
})
