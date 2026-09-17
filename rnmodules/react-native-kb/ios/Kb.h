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
// Hands a tapped notification's payload to JS (the tap slot; see Kb.mm).
FOUNDATION_EXPORT void KbDeliverPushTap(NSString *payload);
