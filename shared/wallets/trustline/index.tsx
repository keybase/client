import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/wallets'
import * as Constants from '../../constants/wallets'
import Asset from './asset-container'

type _Props = {
  acceptedAssets: Array<Types.AssetID>
  accountID: Types.AccountID
  balanceAvailableToSend: string
  canAddTrustline: boolean
  clearTrustlineModal: () => void
  error: string
  loaded: boolean
  onSearchChange: (text: string) => void
  popularAssets: Array<Types.AssetID>
  refresh: () => void
  searchingAssets?: Array<Types.AssetID>
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
          data: props.searchingAssets,
          key: 'section-search',
          keyExtractor: item => `search-item:${item}`,
          title: '',
        },
      ]
    : []),
  ...(!props.searchingAssets && props.acceptedAssets.length
    ? [
        {
          data: props.acceptedAssets,
          key: 'section-accepted',
          keyExtractor: item => `accepted-item:${item}`,
          title: 'Accepted assets',
        },
      ]
    : []),
  ...(!props.searchingAssets && props.popularAssets.length
    ? [
        {
          data: props.popularAssets,
          key: 'section-popular',
          keyExtractor: item => `popular-item:${item}`,
          title: 'Popular assets',
        },
      ]
    : []),
]

// hack around the bug where when we change from search mode where there's no
// section header, into normal mode where there are section headers, first
// section header doesn't show.
const getSectionListKey = (props: BodyProps) =>
  `sl-${props.searchingAssets ? 'sa' : '_'}-${props.acceptedAssets.length ? 'aa' : '_'}-${
    props.popularAssets.length ? 'pa' : '_'
  }`

const sectionHeader = section => !section.title || <Kb.SectionDivider label={section.title} />

const ListUpdateOnMount = (props: BodyProps) => {
  // hack to get `ReactList` to render more than one item on initial mount.
  // Somehow we need two updates here.
  const [updateCounter, setUpdateCounter] = React.useState(0)
  React.useEffect(() => setUpdateCounter(updateCounter => (updateCounter > 1 ? 2 : updateCounter + 1)), [
    updateCounter,
    setUpdateCounter,
  ])

  return (
    <Kb.BoxGrow>
      <Kb.SectionList
        key={getSectionListKey(props)}
        sections={makeSections(props)}
        renderItem={({index, item}) => (
          <Asset
            accountID={props.accountID}
            firstItem={index === 0}
            assetID={item}
            cannotAccept={!props.canAddTrustline}
          />
        )}
        renderSectionHeader={({section}) => sectionHeader(section)}
        // Otherwise on mobile when the search box is focused, two taps are
        // needed to do anything in this list -- one to lose the focus and one
        // to actually propagate the click even through.
        keyboardShouldPersistTaps="handled"
      />
    </Kb.BoxGrow>
  )
}

const Body = (props: BodyProps) => {
  React.useEffect(() => {
    props.refresh()
    return () => props.clearTrustlineModal()
  }, [])
  const {onFocusChange} = props
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
              onFocus={onFocusChange ? () => onFocusChange(true) : null}
              onBlur={onFocusChange ? () => onFocusChange(false) : null}
              waiting={props.waitingSearch}
            />
          </Kb.Box2>
          <Kb.Divider />
          {!props.canAddTrustline && (
            <Kb.Banner color="red">
              <Kb.BannerParagraph
                bannerColor="red"
                content={`Stellar holds ${
                  Constants.trustlineHoldingBalance
                } XLM per trustline, and your available Lumens balance is ${
                  props.balanceAvailableToSend
                } XLM.`}
              />
            </Kb.Banner>
          )}
          {!props.canAddTrustline && !!props.error && <Kb.Divider />}
          {!!props.error && (
            <Kb.Banner color="red">
              <Kb.BannerParagraph bannerColor="red" content={props.error} />
            </Kb.Banner>
          )}
          {props.searchingAssets && !props.searchingAssets.length ? (
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.grow} centerChildren={true}>
              <Kb.Text type="BodySmall">Sorry! No assets were found. Please try again.</Kb.Text>
            </Kb.Box2>
          ) : (
            <ListUpdateOnMount {...props} />
          )}
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
})
