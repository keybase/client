#ifdef __cplusplus
#import "react-native-kb.h"
#endif

#import <React/RCTEventEmitter.h>
#import <foundation/Foundation.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <RNKbSpec/RNKbSpec.h>
#import <React/RCTCallInvokerModule.h>
@interface Kb : RCTEventEmitter <NativeKbSpec,RCTCallInvokerModule>
@end
#endif // RCT_NEW_ARCH_ENABLED

// Singleton to get the paths
@interface FsPathsHolder : NSObject
@property(nonatomic, retain) NSDictionary *fsPaths;
+ (instancetype)sharedFsPathsHolder;
@end
