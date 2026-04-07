# Shared Memory and Data Passing

Runtimes in react-native-worklets do not share memory. Data crosses runtime boundaries through explicit mechanisms.

---

## Closures in Worklets

Worklets capture variables from their surrounding scope. How those captures behave depends on whether the worklet runs on the same runtime or a different one.

### Same runtime (RN Runtime calling a worklet on RN Runtime)

Closures get copies of references. Reassigning the original variable does not affect the worklet's copy. Object mutations are visible in both directions because they share the same object reference.

```tsx
let count = 0;
function logCount() {
  'worklet';
  console.log(count);
}

count = 1;
logCount(); // prints 0 (captured the original value)

// But object mutations are shared:
let obj = { value: 0 };
function mutate() {
  'worklet';
  obj.value += 1;
}
mutate();
console.log(obj.value); // 1
```

### Different runtime (RN Runtime to UI Runtime or Worker Runtime)

The entire closure is serialized (deep-copied) at invocation time. Changes to the original after scheduling have no effect. Object mutations are invisible across runtimes.

```tsx
let obj = { value: 0 };
function logValue() {
  'worklet';
  console.log(obj.value);
}

obj.value = 1;
runOnUISync(logValue); // prints 0 (copied before mutation reached it)
```

### Global scoping

Each Worklet Runtime has its own global scope. Global variables from the RN Runtime (`global.someValue`) are `undefined` on Worklet Runtimes. To access a global value in a worklet, assign it to a local variable to capture it in the closure:

```tsx
global.someValue = 42;
const localCopy = global.someValue;

function readOnUI() {
  'worklet';
  console.log(localCopy); // 42 (captured via closure)
}
```

---

## Serializable (Immutable Cross-Runtime Data)

Serializable is an immutable reference that transfers JavaScript values between runtimes. Once created, the value cannot be changed.

**You rarely need to call `createSerializable` directly.** Functions like `scheduleOnUI`, `runOnUISync`, and `scheduleOnRuntime` automatically serialize arguments and closure values.

```tsx
import { createSerializable } from 'react-native-worklets';

const data = { x: 1, y: 2, z: 3 };
const ref = createSerializable(data);
// `ref` can be passed to any runtime
// Changing `data` after this point has no effect on `ref`
```

### Supported types

Primitives (`number`, `string`, `boolean`, `null`, `undefined`), plain objects, arrays, `Date`, `ArrayBuffer`, typed arrays, `Map`, `Set`, `RegExp`, `Error`, and worklet functions. Objects with custom prototypes require `registerCustomSerializable`.

### registerCustomSerializable

For objects with custom prototypes that need to cross runtime boundaries, register pack/unpack logic:

```tsx
import { registerCustomSerializable } from 'react-native-worklets';

class Vector2D {
  constructor(public x: number, public y: number) {}
  magnitude() { return Math.sqrt(this.x ** 2 + this.y ** 2); }
}

registerCustomSerializable({
  name: 'Vector2D',
  determine(value: object): value is Vector2D {
    'worklet';
    return value instanceof Vector2D;
  },
  pack(value: Vector2D) {
    'worklet';
    return { x: value.x, y: value.y };
  },
  unpack(packed: { x: number; y: number }) {
    'worklet';
    return new Vector2D(packed.x, packed.y);
  },
});
```

- Custom Serializables are global across all Worklet Runtimes.
- Can only be registered from the RN Runtime.
- To use classes that require `new`, disable Worklet Classes in the Babel plugin config: `disableWorkletClasses: true`.

---

## Synchronizable (Shared Mutable State)

Synchronizable holds a mutable value accessible from any runtime without expensive synchronous messaging. Use it to share state that multiple runtimes need to read or write.

```tsx
import { createSynchronizable, scheduleOnUI } from 'react-native-worklets';

const sharedCounter = createSynchronizable(0);

// Read from UI Runtime
scheduleOnUI(() => {
  const value = sharedCounter.getBlocking();
  console.log('Counter:', value);
});

// Write from RN Runtime
sharedCounter.setBlocking(42);
```

### Methods

| Method | Blocking | Description |
|--------|----------|-------------|
| `getBlocking()` | Yes | Exclusively obtains the value. Waits if another thread holds it. |
| `getDirty()` | No | Returns the value without locking. May return stale data (dirty read). Good when eventual consistency is acceptable. |
| `setBlocking(value)` | Yes | Exclusively sets the value. Accepts a direct value or an updater function. |
| `lock()` | Yes | Manually locks the Synchronizable. Other threads block on `getBlocking`/`setBlocking`/`lock` until `unlock()`. |
| `unlock()` | No | Releases the lock. Must be called from the same thread that locked it. Forgetting to unlock causes deadlocks. |

### Updater function pattern

`setBlocking` accepts an updater function for atomic read-modify-write operations. The Synchronizable stays locked for the duration of the updater:

```tsx
sharedCounter.setBlocking((prev) => prev + 1);
```

### Performance tips

- Use primitives (`number`, `string`, `boolean`) for values that change frequently. Each access copies the value to/from C++, and primitives minimize the copy cost.
- Synchronizable is not reactive. Runtimes must poll the value to detect changes.
- Avoid changing the type of the held value. Create separate Synchronizables for different types.
- `getDirty()` is cheaper than `getBlocking()` and suitable for UI display values where occasional stale reads are acceptable.

### Type guards

```tsx
import { isSerializableRef, isSynchronizable } from 'react-native-worklets';

isSerializableRef(value);       // true if value is a SerializableRef
isSynchronizable<number>(value); // true if value is a Synchronizable (with type narrowing)
```

---

## Decision: Serializable vs Synchronizable

| Need | Use |
|------|-----|
| Pass data from RN to UI/Worker once (read-only) | Serializable (automatic via closure/args) |
| Share mutable state between runtimes | Synchronizable |
| Poll shared state from UI thread (e.g., progress) | Synchronizable with `getDirty()` |
| Atomic read-modify-write across threads | Synchronizable with updater function |
