import * as React from 'react'
import {SectionList as NativeSectionList, type SectionListProps} from 'react-native'
import noop from 'lodash/noop'

type Props<ItemT, SectionT> = SectionListProps<ItemT, SectionT>

function SectionListImpl<ItemT, SectionT>(
  props: Props<ItemT, SectionT>,
  ref: React.Ref<NativeSectionList<ItemT, SectionT>>
) {
  return (
    <NativeSectionList
      overScrollMode="never"
      onScrollToIndexFailed={noop}
      keyboardDismissMode="on-drag"
      ref={ref}
      {...props}
    />
  )
}

const SectionList = React.forwardRef(SectionListImpl) as <ItemT, SectionT>(
  props: Props<ItemT, SectionT> & {ref?: React.Ref<NativeSectionList<ItemT, SectionT>>}
) => React.ReactElement

export default SectionList
