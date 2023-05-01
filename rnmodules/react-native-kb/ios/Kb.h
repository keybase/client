#ifdef __cplusplus
#import "react-native-kb.h"
#endif

#ifdef RCT_NEW_ARCH_ENABLED
#import <RNKbSpec/RNKbSpec.h>
#import <React/RCTEventEmitter.h>
#import <foundation/Foundation.h>

@interface Kb : RCTEventEmitter <NativeKbSpec>
#else
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <foundation/Foundation.h>

@interface Kb : RCTEventEmitter <RCTBridgeModule>
#endif

@end

// Singleton to get the paths
@interface FsPathsHolder : NSObject {
  NSDictionary *fsPaths;
}
@property(nonatomic, retain) NSDictionary *fsPaths;
+ (id)sharedFsPathsHolder;

@end
