// Safe msgpack include wrapper.
// ObjC defines `nil` as a macro (#define nil nullptr), which conflicts with
// msgpack's `typedef nil_t nil;`. This header saves/undefines nil before
// including msgpack and restores it afterward, so it's safe to use from
// both .cpp and .mm files.
#pragma once

#ifdef nil
#pragma push_macro("nil")
#undef nil
#define KB_MSGPACK_NIL_PUSHED
#endif

#include <msgpack.hpp>

#ifdef KB_MSGPACK_NIL_PUSHED
#pragma pop_macro("nil")
#undef KB_MSGPACK_NIL_PUSHED
#endif
