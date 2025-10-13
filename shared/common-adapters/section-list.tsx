import * as React from 'react'
import {
  SectionList as NativeSectionList,
  type SectionListProps,
  type ViewToken,
  type SectionListData,
} from 'react-native'
import noop from 'lodash/noop'

export type SectionType<Item> = {
  title?: string
  data: ReadonlyArray<Item>
  keyExtractor?: (item: Item, index: number) => string
  renderItem: ({index, item}: {index: number; item: Item}) => React.ReactElement | null
  renderSectionHeader?: (info: {section: SectionType<Item>}) => React.ReactElement | null
}

type Props<ItemT, SectionT> = SectionListProps<ItemT, SectionT> & {
  getItemHeight?: (item: ItemT | undefined, sectionIndex: number, indexWithinSection: number) => number
  getSectionHeaderHeight?: (sectionIndex: number) => number
  onSectionChange?: (section: SectionT) => void
}

function SectionListImpl<ItemT, SectionT>(
  props: Props<ItemT, SectionT>,
  ref: React.Ref<NativeSectionList<ItemT, SectionT>>
) {
  const {getItemHeight, getSectionHeaderHeight, onSectionChange, ...rest} = props
  const getItemLayout = React.useMemo(() => {
    return getItemHeight && getSectionHeaderHeight
      ? getGetItemLayout<ItemT, SectionT>({getItemHeight, getSectionHeaderHeight})
      : undefined
  }, [getItemHeight, getSectionHeaderHeight])
  const onViewableItemsChanged = onSectionChange
    ? (e: {viewableItems: ViewToken<ItemT>[]}) => {
        const section = e.viewableItems[0]?.section as SectionT | undefined
        section && onSectionChange(section)
      }
    : undefined

  return (
    <NativeSectionList
      overScrollMode="never"
      getItemLayout={getItemLayout}
      onViewableItemsChanged={onViewableItemsChanged}
      onScrollToIndexFailed={noop}
      keyboardDismissMode="on-drag"
      ref={ref}
      {...rest}
    />
  )
}

export type SectionListRef<ItemT, SectionT> = NativeSectionList<ItemT, SectionT>
//export type SectionListRef<ItemT, SectionT> = React.RefObject<NativeSectionList<ItemT, SectionT> | null>
//export type SectionListRef = React.RefObject<NativeSectionList<unknown, unknown>>

const SectionList = React.forwardRef(SectionListImpl) as <ItemT, SectionT>(
  props: Props<ItemT, SectionT> & {ref?: React.Ref<NativeSectionList<ItemT, SectionT>>}
) => React.ReactElement

export default SectionList

// From https://github.com/jsoendermann/rn-section-list-get-item-layout
// Author Jan Soendermann
// Apache License, Version 2.0

interface SectionHeader {
  type: 'SECTION_HEADER'
}

interface Row {
  type: 'ROW'
  index: number
}

interface SectionFooter {
  type: 'SECTION_FOOTER'
}

type ListElement = SectionHeader | Row | SectionFooter

export interface Parameters<ItemT> {
  getItemHeight: (rowData: ItemT | undefined, sectionIndex: number, rowIndex: number) => number
  getSeparatorHeight?: (sectionIndex: number, rowIndex: number) => number
  getSectionHeaderHeight?: (sectionIndex: number) => number
  getSectionFooterHeight?: (sectionIndex: number) => number
  listHeaderHeight?: number | (() => number)
}

function getGetItemLayout<ItemT, SectionT>({
  getItemHeight,
  getSeparatorHeight = () => 0,
  getSectionHeaderHeight = () => 0,
  getSectionFooterHeight = () => 0,
  listHeaderHeight = 0,
}: Parameters<ItemT>) {
  return (data: SectionListData<ItemT, SectionT>[] | null, index: number) => {
    let i = 0
    let sectionIndex = 0
    let elementPointer: ListElement = {type: 'SECTION_HEADER'}
    let offset = typeof listHeaderHeight === 'function' ? listHeaderHeight() : listHeaderHeight

    while (i < index) {
      switch (elementPointer.type) {
        case 'SECTION_HEADER': {
          const sectionData = data?.[sectionIndex]?.data

          offset += getSectionHeaderHeight(sectionIndex)

          // If this section is empty, we go right to the footer...
          if (sectionData?.length === 0) {
            elementPointer = {type: 'SECTION_FOOTER'}
            // ...otherwise we make elementPointer point at the first row in this section
          } else {
            elementPointer = {index: 0, type: 'ROW'}
          }

          break
        }
        case 'ROW': {
          const sectionData = data?.[sectionIndex]?.data
          const rowIndex = elementPointer.index

          offset += getItemHeight(sectionData?.[rowIndex], sectionIndex, rowIndex)
          elementPointer.index += 1

          if (rowIndex === (sectionData?.length ?? 0) - 1) {
            elementPointer = {type: 'SECTION_FOOTER'}
          } else {
            offset += getSeparatorHeight(sectionIndex, rowIndex)
          }

          break
        }
        case 'SECTION_FOOTER': {
          offset += getSectionFooterHeight(sectionIndex)
          sectionIndex += 1
          elementPointer = {type: 'SECTION_HEADER'}
          break
        }
      }

      i += 1
    }

    let length: number
    switch (elementPointer.type) {
      case 'SECTION_HEADER':
        length = getSectionHeaderHeight(sectionIndex)
        break
      case 'ROW': {
        const rowIndex = elementPointer.index
        length = getItemHeight(data?.[sectionIndex]?.data[rowIndex], sectionIndex, rowIndex)
        break
      }
      case 'SECTION_FOOTER':
        length = getSectionFooterHeight(sectionIndex)
        break
      default:
        throw new Error('Unknown elementPointer.type')
    }

    return {index, length, offset}
  }
}
