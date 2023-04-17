#ifdef __cplusplus
#import "react-native-kb.h"
#endif

@protocol KbProvider
- (NSDictionary *)fsPaths;
@end

#ifdef RCT_NEW_ARCH_ENABLED
#import <RNKbSpec/RNKbSpec.h>

@interface Kb : NSObject <NativeKbSpec>
#else
#import <React/RCTBridgeModule.h>

@interface Kb : NSObject <RCTBridgeModule>
#endif

@end
