// Import first in a test file to load modules as mobile. jest.setup.js defaults isMobile to false,
// and some stores (e.g. push) pick their platform's dispatch once, when the module loads, so
// flipping the global inside a test is too late for them.
;(globalThis as unknown as {isMobile: boolean}).isMobile = true

export {}
