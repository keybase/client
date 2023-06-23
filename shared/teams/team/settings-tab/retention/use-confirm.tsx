import * as Z from '../../../../util/zustand'
import type {RetentionPolicy} from '../../../../constants/types/retention-policy'
type ZState = {
  confirmed: RetentionPolicy | undefined
  updateConfirm: (rt: RetentionPolicy | undefined) => void
}
export const useConfirm = Z.createZustand(
  Z.immerZustand<ZState>(set => ({
    confirmed: undefined,
    updateConfirm: (rt: RetentionPolicy | undefined) => {
      set(state => {
        state.confirmed = rt
      })
    },
  }))
)
