import * as React from 'react'
import type {Props, Section} from './section-list'
import {SectionList as NativeSectionList} from 'react-native'
import noop from 'lodash/noop'

const SectionList = React.forwardRef<NativeSectionList, Props<any>>(function SectionList<
  T extends Section<any, any>
>(props: Props<T>, forwardedRef: React.Ref<NativeSectionList>) {
  const {getItemHeight, getSectionHeaderHeight, onSectionChange, ...rest} = props
  const getItemLayout = React.useMemo(() => {
    return getItemHeight && getSectionHeaderHeight
      ? getGetItemLayout({
          getItemHeight,
          getSectionHeaderHeight,
        })
      : undefined
  }, [getItemHeight, getSectionHeaderHeight])
  const onViewableItemsChanged = onSectionChange
    ? e => {
        const section = e.viewableItems[0]?.section
        section && onSectionChange(section)
      }
    : undefined

  const NativeSectionListAny = NativeSectionList as any
  return (
    <NativeSectionListAny
      overScrollMode="never"
      onScrollToIndexFailed={noop}
      keyboardDismissMode="on-drag"
      ref={forwardedRef}
      {...rest}
      getItemLayout={getItemLayout as any}
      onViewableItemsChanged={onViewableItemsChanged}
    />
  )
})

export default SectionList

// From https://github.com/jsoendermann/rn-section-list-get-item-layout
// Author Jan Soendermann
// Apache License, Version 2.0

type SectionListDataProp = Array<{
  title: string
  data: any[]
}>

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

export interface Parameters {
  getItemHeight: (rowData: any, sectionIndex: number, rowIndex: number) => number
  getSeparatorHeight?: (sectionIndex: number, rowIndex: number) => number
  getSectionHeaderHeight?: (sectionIndex: number) => number
  getSectionFooterHeight?: (sectionIndex: number) => number
  listHeaderHeight?: number | (() => number)
}

const getGetItemLayout =
  ({
    getItemHeight,
    getSeparatorHeight = () => 0,
    getSectionHeaderHeight = () => 0,
    getSectionFooterHeight = () => 0,
    listHeaderHeight = 0,
  }: Parameters) =>
  (data: SectionListDataProp, index: number) => {
    let i = 0
    let sectionIndex = 0
    let elementPointer: ListElement = {type: 'SECTION_HEADER'}
    let offset = typeof listHeaderHeight === 'function' ? listHeaderHeight() : listHeaderHeight

    while (i < index) {
      switch (elementPointer.type) {
        case 'SECTION_HEADER': {
          const sectionData = data[sectionIndex].data

          offset += getSectionHeaderHeight(sectionIndex)

          // If this section is empty, we go right to the footer...
          if (sectionData.length === 0) {
            elementPointer = {type: 'SECTION_FOOTER'}
            // ...otherwise we make elementPointer point at the first row in this section
          } else {
            elementPointer = {index: 0, type: 'ROW'}
          }

          break
        }
        case 'ROW': {
          const sectionData = data[sectionIndex].data

          const rowIndex = elementPointer.index

          offset += getItemHeight(sectionData[rowIndex], sectionIndex, rowIndex)
          elementPointer.index += 1

          if (rowIndex === sectionData.length - 1) {
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
        length = getItemHeight(data[sectionIndex].data[rowIndex], sectionIndex, rowIndex)
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
