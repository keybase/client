export type UseResizeObserverCallback = (entry: ResizeObserverEntry, observer: ResizeObserver) => unknown

declare function useResizeObserver<T extends Element>(
  target: React.RefObject<T> | React.ForwardedRef<T> | T | null,
  callback: UseResizeObserverCallback
): ResizeObserver
export default useResizeObserver
