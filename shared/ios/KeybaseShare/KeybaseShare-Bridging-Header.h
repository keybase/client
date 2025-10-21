//
//  Use this file to import your target's public headers that you would like to expose to Swift.
//

// WORKAROUND: iOS SDK 18 / Xcode 16 malloc header bug with pointer authentication
// 
// When ENABLE_POINTER_AUTHENTICATION = YES, the SDK's malloc/_malloc_type.h header
// references undefined _backdeploy symbols, causing compilation to fail.
// This workaround disables the _MALLOC_TYPED macro to avoid the bug.
// 
// NOTE: CLANG_ENABLE_MODULES = NO is also required in build settings to prevent
// precompiled system modules from being generated before this workaround takes effect.
// This makes builds slower but is necessary until Apple fixes the SDK bug.
//
// Related: This can be removed when Apple releases a fixed SDK in a future Xcode update.
#define _MALLOC_TYPED(x,y)

