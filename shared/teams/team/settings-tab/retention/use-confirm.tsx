import * as Container from '../../../../util/container'
import type {RetentionPolicy} from '../../../../constants/types/retention-policy'
type ZState = {
  confirmed: RetentionPolicy | undefined
  updateConfirm: (rt: RetentionPolicy | undefined) => void
}
export const useConfirm = Container.createZustand(
  Container.immerZustand<ZState>(set => ({
    confirmed: undefined,
    updateConfirm: (rt: RetentionPolicy | undefined) => {
      set(state => {
        state.confirmed = rt
      })
    },
  }))
)
