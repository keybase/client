#ifdef __cplusplus
#import "react-native-kb.h"
#endif

#import <React/RCTInvalidating.h>
#import <foundation/Foundation.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <RNKbSpec/RNKbSpec.h>
#import <React/RCTCallInvokerModule.h>
#import <ReactCommon/RCTTurboModuleWithJSIBindings.h>
@interface Kb : NativeKbSpecBase <NativeKbSpec,RCTCallInvokerModule,RCTTurboModuleWithJSIBindings,RCTInvalidating>
@end
#else
#endif // RCT_NEW_ARCH_ENABLED

// Singleton to get the paths
@interface FsPathsHolder : NSObject
@property(nonatomic, copy) NSDictionary *fsPaths;
+ (instancetype)sharedFsPathsHolder;
@end

// Push notification helpers - can be called from AppDelegate
FOUNDATION_EXPORT void KbSetDeviceToken(NSString *token);
// Main thread only. Holds a tapped notification's userInfo for peekPushTap,
// replacing any tap JS has not acked, and tells JS.
FOUNDATION_EXPORT void KbSetPushTap(NSDictionary *userInfo);
// Main thread only. Call next to each Go SetAppState* report with "active",
// "inactive" or "background"; the latest value is kept for getAppLifecycleState
// so JS can read what it missed before it listened.
FOUNDATION_EXPORT void KbEmitAppLifecycle(NSString *state);
