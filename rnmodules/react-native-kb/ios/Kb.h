#ifdef __cplusplus
#import "react-native-kb.h"
#endif

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

@interface Kb : NSObject <NativeKbSpec>
@end
