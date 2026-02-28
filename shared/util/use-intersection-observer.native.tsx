import type {MockIntersectionObserverEntry} from './use-intersection-observer'
function useIntersectionObserver(): MockIntersectionObserverEntry {
  return {
    boundingClientRect: null,
    intersectionRatio: null,
    intersectionRect: null,
    isIntersecting: false,
    rootBounds: null,
    target: null,
    time: null,
  }
}

export default useIntersectionObserver
