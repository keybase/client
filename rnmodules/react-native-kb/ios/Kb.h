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
// Emits to JS when its push listener is ready. Otherwise a tap
// (userInteraction) is kept for getInitialNotification and anything else is
// queued until JS is ready, so a push that arrives while React Native isn't
// running (a background launch never starts it) is not lost.
FOUNDATION_EXPORT void KbDeliverPushNotification(NSDictionary *notification);
