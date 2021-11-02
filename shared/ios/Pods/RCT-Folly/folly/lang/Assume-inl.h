/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#pragma once

#include <folly/Likely.h>
#include <folly/Portability.h>

namespace folly {

namespace detail {

[[noreturn]] void assume_terminate();

} // namespace detail

FOLLY_ALWAYS_INLINE void assume(bool cond) {
  if (kIsDebug) {
    if (FOLLY_UNLIKELY(!cond)) {
      detail::assume_terminate();
    }
  } else {
#if defined(__clang__) // Must go first because Clang also defines __GNUC__.
    __builtin_assume(cond);
#elif defined(__GNUC__)
    if (!cond) {
      __builtin_unreachable();
    }
#elif defined(_MSC_VER)
    __assume(cond);
#else
    // Do nothing.
#endif
  }
}

[[noreturn]] FOLLY_ALWAYS_INLINE void assume_unreachable() {
#if defined(__GNUC__)
  __builtin_unreachable();
#elif defined(_MSC_VER)
  __assume(0);
#else
  detail::assume_terminate();
#endif
}

} // namespace folly
