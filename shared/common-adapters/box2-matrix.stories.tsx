import type * as React from 'react'
import type {Meta, StoryObj} from '@storybook/react'
import Text from './text'
import {Box2, type Box2Props} from './box'
import * as Styles from '@/styles'

// Primitive-level evidence for Box2's default alignment: every cell is a fixed-size parent, so any
// change in how its children size or align themselves moves pixels in the screenshot.

type Direction = Box2Props['direction']
type ChildSpec = {label: string; color: string; props: Partial<Box2Props>}

const theme = Styles.getTheme()

const directions: ReadonlyArray<Direction> = ['horizontal', 'horizontalReverse', 'vertical', 'verticalReverse']
const parentAlignItems: ReadonlyArray<NonNullable<Box2Props['alignItems']>> = [
  'center',
  'flex-start',
  'flex-end',
  'stretch',
]

const Child = (p: {spec: ChildSpec}) => {
  const {spec} = p
  const {label, color, props} = spec
  return (
    <Box2
      direction="vertical"
      {...props}
      alignSelf={props.alignSelf ?? (props.fullWidth || props.fullHeight ? undefined : 'center')}
      style={Styles.collapseStyles([props.style, {backgroundColor: color}])}
    >
      <Text type="BodyTiny">{label}</Text>
    </Box2>
  )
}

const Cell = (p: {
  title: string
  direction: Direction
  alignItems?: Box2Props['alignItems']
  childSpecs: ReadonlyArray<ChildSpec>
}) => {
  const {title, direction, alignItems, childSpecs} = p
  return (
    <Box2 direction="vertical" alignSelf="flex-start" gap="xxtiny">
      <Text type="BodySmallSemibold">{title}</Text>
      <Box2 alignSelf="center" direction={direction} alignItems={alignItems} style={styles.parent}>
        {childSpecs.map(c => (
          <Child key={c.label} spec={c} />
        ))}
      </Box2>
    </Box2>
  )
}

const Column = (p: {children: React.ReactNode}) => {
  const {children} = p
  return (
    <Box2 direction="vertical" alignSelf="flex-start" gap="tiny" style={styles.column}>
      {children}
    </Box2>
  )
}

const widthChildren = (): ReadonlyArray<ChildSpec> => [
  {color: theme.blueLight, label: 'no width props', props: {}},
  {color: theme.greenLight, label: 'fullWidth', props: {fullWidth: true}},
  {color: theme.yellow, label: 'alignSelf flex-start', props: {alignSelf: 'flex-start'}},
]

const DirectionMatrix = (p: {direction: Direction}) => {
  const {direction} = p
  return (
    <Column>
      {parentAlignItems.map(a => (
        <Cell key={a} title={`${direction} / alignItems ${a}`} direction={direction} alignItems={a} childSpecs={widthChildren()} />
      ))}
    </Column>
  )
}

const VariantMatrix = (p: {childSpecs: ReadonlyArray<ChildSpec>}) => {
  const {childSpecs} = p
  return (
    <Column>
      {directions.map(d => (
        <Cell key={d} title={d} direction={d} childSpecs={childSpecs} />
      ))}
    </Column>
  )
}

const meta: Meta = {title: 'Common/Box2 matrix'}
export default meta
type Story = StoryObj

export const Horizontal: Story = {render: () => <DirectionMatrix direction="horizontal" />}
export const HorizontalReverse: Story = {render: () => <DirectionMatrix direction="horizontalReverse" />}
export const Vertical: Story = {render: () => <DirectionMatrix direction="vertical" />}
export const VerticalReverse: Story = {render: () => <DirectionMatrix direction="verticalReverse" />}

export const Flex: Story = {
  render: () => (
    <VariantMatrix
      childSpecs={[
        {color: theme.blueLight, label: 'flex 1', props: {flex: 1}},
        {color: theme.greenLight, label: 'flex 2', props: {style: {flex: 2}}},
        {color: theme.yellow, label: 'no width props', props: {}},
      ]}
    />
  ),
}

export const Gap: Story = {
  render: () => (
    <VariantMatrix
      childSpecs={[
        {color: theme.blueLight, label: 'gap tiny', props: {gap: 'tiny'}},
        {color: theme.greenLight, label: 'gap tiny + start', props: {gap: 'tiny', gapStart: true}},
        {
          color: theme.yellow,
          label: 'gap tiny + start + end, horizontal',
          props: {direction: 'horizontal', gap: 'tiny', gapEnd: true, gapStart: true},
        },
      ]}
    />
  ),
}

export const Padding: Story = {
  render: () => (
    <VariantMatrix
      childSpecs={[
        {color: theme.blueLight, label: 'padding small', props: {padding: 'small'}},
        {color: theme.greenLight, label: 'padding xtiny fullWidth', props: {fullWidth: true, padding: 'xtiny'}},
        {
          color: theme.yellow,
          label: 'padding tiny centerChildren',
          props: {centerChildren: true, padding: 'tiny'},
        },
      ]}
    />
  ),
}

// Props whose desktop classes once resolved differently from native.
export const Overrides: Story = {
  render: () => (
    <VariantMatrix
      childSpecs={[
        {
          color: theme.blueLight,
          label: 'centerChildren + alignItems stretch',
          props: {alignItems: 'stretch', centerChildren: true, fullWidth: true},
        },
        {color: theme.greenLight, label: 'noShrink + flex 1', props: {flex: 1, noShrink: true}},
        {color: theme.yellow, label: 'noShrink + style flex 1', props: {noShrink: true, style: {flex: 1}}},
      ]}
    />
  ),
}

const styles = {
  column: {padding: Styles.globalMargins.small},
  parent: {backgroundColor: theme.greyLight, height: 120, width: 300},
} as const
