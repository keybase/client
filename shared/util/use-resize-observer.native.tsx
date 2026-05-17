type FakeResizeObserver = {
  disconnect: () => void
  observe: () => void
  unobserve: () => void
}

function useResizeObserver(_target?: unknown, _callback?: unknown): FakeResizeObserver {
  return {
    disconnect: () => {},
    observe: () => {},
    unobserve: () => {},
  }
}

export default useResizeObserver
