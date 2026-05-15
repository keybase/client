import type {MeasureRef} from '@/common-adapters/measure-ref'

export type UseResizeObserverCallback = (entry: {contentRect: {width: number; height: number}}, observer: unknown) => unknown

declare function useResizeObserver<T extends MeasureRef>(
  target: React.RefObject<T | null> | T | null,
  callback: UseResizeObserverCallback
): unknown
export default useResizeObserver
