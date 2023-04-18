#ifdef __cplusplus
#import "react-native-kb.h"
#endif
#import <React/RCTEventEmitter.h>
//@protocol KbProvider
//- (NSDictionary *)fsPaths;
//@end
//
#import <foundation/Foundation.h>

// Singleton to get the paths
@interface FsPathsHolder : NSObject {
    NSDictionary *fsPaths;
}
@property (nonatomic, retain) NSDictionary *fsPaths;
+ (id)sharedFsPathsHolder;

@end

#import <RNKbSpec/RNKbSpec.h>

@interface Kb : RCTEventEmitter <NativeKbSpec>
@end
