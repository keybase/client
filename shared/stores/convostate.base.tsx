/*
 * Test alias for convo-state behavior tests.
 *
 * Today this file simply re-exports `./convostate` so the Jest suite can stay
 * focused on direct behavior coverage while there is only one implementation.
 *
 * When we want side-by-side baseline vs refactor validation again:
 * 1. Replace this file with a copied baseline implementation.
 * 2. Keep the same exported testing hooks (`createConvoStoreForTesting`, etc.).
 * 3. The tests in `convostate.test.ts` already instantiate both modules, so the
 *    differential harness plugs back in here without restructuring the suite.
 */

export * from './convostate'
