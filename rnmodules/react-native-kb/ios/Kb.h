#ifdef __cplusplus
#import "react-native-kb.h"
#endif

#import <RNKbSpec/RNKbSpec.h>
#import <React/RCTEventEmitter.h>
#import <foundation/Foundation.h>
#import <React/RCTCallInvokerModule.h>

@interface Kb : RCTEventEmitter <NativeKbSpec,RCTCallInvokerModule>
@end

// Singleton to get the paths
@interface FsPathsHolder : NSObject
@property(nonatomic, retain) NSDictionary *fsPaths;
+ (instancetype)sharedFsPathsHolder;
@end
