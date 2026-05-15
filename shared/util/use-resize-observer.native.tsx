type FakeResizeObserver = {
  disconnect: () => void
  observe: () => void
  unobserve: () => void
}

function useResizeObserver(): FakeResizeObserver {
  return {
    disconnect: () => {},
    observe: () => {},
    unobserve: () => {},
  }
}

export default useResizeObserver
