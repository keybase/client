import * as React from 'react'
import { StylesCrossPlatform } from '../../styles';
import { IconType } from '../icon.constants';
export type Action = {
  custom?: React.ElementType,
  label?: string,
  icon?: IconType,
  iconColor?: string,
  onPress?: Function | null
};
export type Props = {
  onBack?: () => void | null,
  onCancel?: () => void | null,
  customCancelText?: string,
  rightActionLabel?: string,
  onRightAction?: () => void | null,
  badgeNumber?: number,
  borderless?: boolean,
  titleComponent?: React.ElementType,
  title?: string,
  leftAction?: "back" | "cancel",
  onLeftAction?: () => void | null,
  leftActionText?: string,
  hideBackLabel?: boolean,
  customComponent?: React.ElementType | null,
  customSafeAreaBottomStyle?: StylesCrossPlatform,
  customSafeAreaTopStyle?: StylesCrossPlatform,
  headerStyle?: StylesCrossPlatform,
  theme?: "light" | "dark",
  rightActions?: Action | null[],
  underNotch?: boolean
};
export type LeftActionProps = {
  badgeNumber?: number,
  disabled?: boolean,
  customCancelText?: string,
  hasTextTitle?: boolean,
  hideBackLabel?: boolean,
  leftAction?: "back" | "cancel" | null,
  leftActionText?: string,
  theme?: "light" | "dark",
  onLeftAction: () => void | null
};
