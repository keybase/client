// The Metro eval body that installs the app's error capture, kept apart so jest can run it against a
// fake runtime.
import {UNCAUGHT_PREFIX} from './step-lib.ts'

// Installs the capture once per JS runtime and returns the runtime's token; with `clear`, a runtime
// that already has it drops what it holds. Every module is resolved before anything is wrapped and
// the runtime is marked last, so a lookup that throws leaves nothing installed for the next call to
// take as done.
//
// RN reports an unhandled promise rejection through ExceptionsManager.handleException, not the
// ErrorUtils handler, so both are wrapped; an error ErrorUtils hands on to handleException is kept
// once. React hands every render error to ReactFiberErrorDialog.showErrorDialog, which calls
// handleException too: one an error boundary caught (its errorBoundary is set) is kept once as a
// console error, never as uncaught.
export const errorCaptureBody = (clear: boolean) => `const g = globalThis;
  if (g.__kbE2EErrorsRuntime !== g.__kbE2ERuntime || !g.__kbE2EErrors) {
    const em = kbModule('node_modules/react-native/Libraries/Core/ExceptionsManager.js').default;
    const dialog = kbModule('node_modules/react-native/Libraries/Core/ReactFiberErrorDialog.js').default;
    if (!em || typeof em.handleException !== 'function') throw new Error('ExceptionsManager has no handleException');
    if (!dialog || typeof dialog.showErrorDialog !== 'function') throw new Error('ReactFiberErrorDialog has no showErrorDialog');
    const errors = [];
    const fmt = a => (a instanceof Error ? a.name + ': ' + a.message + '\\n' + (a.stack || '') : typeof a === 'string' ? a : (() => { try { return JSON.stringify(a) } catch { return String(a) } })());
    const keep = s => { try { errors.push(s) } catch {} };
    let inGlobalHandler = false;
    let inCaughtDialog = false;
    const origError = console.error;
    console.error = function (...args) {
      if (!inCaughtDialog) keep(args.map(fmt).join(' '));
      return origError.apply(this, args);
    };
    const eu = g.ErrorUtils;
    if (eu) {
      const prev = eu.getGlobalHandler();
      eu.setGlobalHandler((e, isFatal) => {
        keep(${JSON.stringify(UNCAUGHT_PREFIX)} + fmt(e));
        inGlobalHandler = true;
        try { prev(e, isFatal) } finally { inGlobalHandler = false }
      });
    }
    const showErrorDialog = dialog.showErrorDialog;
    dialog.showErrorDialog = function (captured) {
      if (!captured || captured.errorBoundary == null) return showErrorDialog.apply(this, arguments);
      inCaughtDialog = true;
      try { return showErrorDialog.apply(this, arguments) } finally { inCaughtDialog = false }
    };
    const handleException = em.handleException;
    em.handleException = function (e, isFatal) {
      if (inCaughtDialog) keep(fmt(e));
      else if (!inGlobalHandler) keep(${JSON.stringify(UNCAUGHT_PREFIX)} + fmt(e));
      return handleException.apply(this, arguments);
    };
    g.__kbE2EErrors = errors;
    g.__kbE2EErrorsRuntime = g.__kbE2ERuntime;
  } else if (${clear}) {
    g.__kbE2EErrors.length = 0;
  }
  return g.__kbE2ERuntime ?? null;`
