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
FOUNDATION_EXPORT void KbSetInitialNotification(NSDictionary *notification);
FOUNDATION_EXPORT void KbEmitPushNotification(NSDictionary *notification);
// Re-emits a stored user-interaction notification once when the app becomes
// active (covers notification taps that arrive before React Native is ready).
FOUNDATION_EXPORT void KbEmitStoredNotificationOnBecomeActive(void);
