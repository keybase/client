import * as Kb from '@/common-adapters'
import * as React from 'react'
import AlphabetIndex from './alphabet-index'
import PeopleResult from './search-result/people-result'
import UserResult from './search-result/user-result'
import type * as Types from './types'
import {ContactsImportButton} from './contacts'
import {userResultHeight} from './search-result/common-result'
import {createAnimatedComponent} from '@/common-adapters/reanimated'
import type {Props as SectionListProps, Section as SectionType} from '@/common-adapters/section-list'

export const numSectionLabel = '0-9'

const isImportContactsEntry = (x: Types.ResultData): x is Types.ImportContactsEntry =>
  'isImportButton' in x && !!x.isImportButton

const isSearchHintEntry = (x: Types.ResultData): x is Types.SearchHintEntry =>
  'isSearchHint' in x && !!x.isSearchHint

const SearchHintText = () => (
  <Kb.Box2 direction="vertical" style={styles.searchHint}>
    <Kb.Text type="BodySmall" style={{textAlign: 'center'}}>
      Search anyone on Keybase by typing a username or a full name.
    </Kb.Text>
  </Kb.Box2>
)

const TeamAlphabetIndex = (
  props: Pick<Types.Props, 'recommendations' | 'teamSoFar'> & {
    sectionListRef: React.RefObject<Kb.SectionList<SectionType<Types.ResultData, Types.SearchRecSection>>>
  }
) => {
  const {recommendations, teamSoFar, sectionListRef} = props
  let showNumSection = false
  let labels: Array<string> = []
  if (recommendations && recommendations.length > 0) {
    showNumSection = recommendations.at(-1)?.label === numSectionLabel
    labels = recommendations.filter(r => r.shortcut && r.label !== numSectionLabel).map(r => r.label)
  }

  const _onScrollToSection = (label: string) => {
    if (sectionListRef.current) {
      const ref = sectionListRef.current
      const sectionIndex =
        (recommendations &&
          (label === 'numSection'
            ? recommendations.length - 1
            : recommendations.findIndex(section => section.label === label))) ||
        -1
      if (sectionIndex >= 0 && Kb.Styles.isMobile) {
        ref.scrollToLocation({
          animated: false,
          itemIndex: 0,
          sectionIndex,
        })
      }
    }
  }

  if (!labels.length) {
    return null
  }
  return (
    <>
      <AlphabetIndex
        labels={labels}
        showNumSection={showNumSection}
        onScroll={_onScrollToSection}
        style={styles.alphabetIndex}
        measureKey={!!teamSoFar.length}
      />
    </>
  )
}

const SectionList = createAnimatedComponent<
  SectionListProps<SectionType<Types.ResultData, Types.SearchRecSection>>
>(Kb.SectionList)

const _listIndexToSectionAndLocalIndex = (
  highlightedIndex?: number,
  sections?: Types.SearchRecSection[]
): {index: number; section: Types.SearchRecSection} | undefined => {
  if (highlightedIndex !== undefined && sections !== undefined) {
    let index = highlightedIndex
    for (const section of sections) {
      if (index >= section.data.length) {
        index -= section.data.length
      } else {
        return {index, section}
      }
    }
  }
  return
}
export const RecsAndRecos = (
  props: Pick<
    Types.Props,
    | 'highlightedIndex'
    | 'recommendations'
    | 'namespace'
    | 'selectedService'
    | 'onAdd'
    | 'onRemove'
    | 'teamSoFar'
  > &
    Types.OnScrollProps & {
      recommendedHideYourself: boolean
    }
) => {
  const {highlightedIndex, recommendations, onScroll, recommendedHideYourself, namespace} = props
  const {selectedService, onAdd, onRemove, teamSoFar} = props

  const sectionListRef =
    React.useRef<Kb.SectionList<SectionType<Types.ResultData, Types.SearchRecSection>>>(null)
  const ResultRow = namespace === 'people' ? PeopleResult : UserResult

  const _getRecLayout = (
    sections: Array<Types.SearchRecSection>,
    indexInList: number
  ): {index: number; length: number; offset: number} => {
    const sectionDividerHeight = Kb.SectionDivider.height
    const dataRowHeight = userResultHeight

    let numSections = 0
    let numData = 0
    let length = dataRowHeight
    let currSectionHeaderIdx = 0
    for (const s of sections) {
      if (indexInList === currSectionHeaderIdx) {
        // we are the section header
        length = Kb.SectionDivider.height
        break
      }
      numSections++
      const indexInSection = indexInList - currSectionHeaderIdx - 1
      if (indexInSection === s.data.length) {
        // it's the section footer (we don't render footers so 0px).
        numData += s.data.length
        length = 0
        break
      }
      if (indexInSection < s.data.length) {
        // we are in this data
        numData += indexInSection
        break
      }
      // we're not in this section
      numData += s.data.length
      currSectionHeaderIdx += s.data.length + 2 // +2 because footer
    }
    const offset = numSections * sectionDividerHeight + numData * dataRowHeight
    return {index: indexInList, length, offset}
  }

  const highlightDetails = React.useMemo(
    () => _listIndexToSectionAndLocalIndex(highlightedIndex, recommendations),
    [highlightedIndex, recommendations]
  )
  return (
    <Kb.BoxGrow>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.listContainer}>
        <SectionList
          ref={Kb.Styles.isMobile ? sectionListRef : undefined}
          contentContainerStyle={{minHeight: '133%'}}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          scrollEventThrottle={1}
          onScroll={onScroll}
          selectedIndex={Kb.Styles.isMobile ? undefined : highlightedIndex || 0}
          sections={recommendations ?? []}
          keyExtractor={(item: Types.ResultData, index: number) => {
            if (!isImportContactsEntry(item) && !isSearchHintEntry(item) && item.contact) {
              // Ids for contacts are not guaranteed to be unique
              return item.userId + index
            }
            return isImportContactsEntry(item)
              ? 'Import Contacts'
              : isSearchHintEntry(item)
                ? 'New User Search Hint'
                : item.userId
          }}
          getItemLayout={_getRecLayout}
          renderItem={({index, item: result, section}) =>
            result.isImportButton ? (
              <ContactsImportButton />
            ) : result.isSearchHint ? (
              <SearchHintText />
            ) : recommendedHideYourself && result.isYou ? null : (
              <ResultRow
                namespace={namespace}
                resultForService={selectedService}
                username={result.username}
                prettyName={result.prettyName}
                pictureUrl={result.pictureUrl}
                displayLabel={result.displayLabel}
                services={result.services}
                inTeam={result.inTeam}
                isPreExistingTeamMember={result.isPreExistingTeamMember}
                isYou={result.isYou}
                followingState={result.followingState}
                highlight={
                  !Kb.Styles.isMobile &&
                  !!highlightDetails &&
                  highlightDetails.section === section &&
                  highlightDetails.index === index
                }
                userId={result.userId}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            )
          }
          renderSectionHeader={({section: {label}}) =>
            label && (!Kb.Styles.isMobile || label !== 'Recommendations') ? (
              <Kb.SectionDivider label={label} />
            ) : null
          }
        />
        {Kb.Styles.isMobile && (
          <TeamAlphabetIndex
            recommendations={recommendations}
            sectionListRef={sectionListRef}
            teamSoFar={teamSoFar}
          />
        )}
      </Kb.Box2>
    </Kb.BoxGrow>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      alphabetIndex: {
        maxHeight: '80%',
        position: 'absolute',
        right: 0,
        top: Kb.Styles.globalMargins.large,
      },
      listContainer: Kb.Styles.platformStyles({
        common: {position: 'relative'},
        isElectron: {flex: 1, height: '100%', overflow: 'hidden'},
        isMobile: {
          flexGrow: 1,
          width: '100%',
        },
      }),
      searchHint: {
        paddingLeft: Kb.Styles.globalMargins.xlarge,
        paddingRight: Kb.Styles.globalMargins.xlarge,
        paddingTop: Kb.Styles.globalMargins.xlarge,
      },
    }) as const
)
