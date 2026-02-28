function useResizeObserver(): ResizeObserver {
  return {
    disconnect: () => {},
    observe: () => {},
    unobserve: () => {},
  }
}

export default useResizeObserver
