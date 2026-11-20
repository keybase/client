//
//  KBRModels.m
//  KBKit
//

#import "KBRModels.h"

@implementation KBRStatus
@end

@implementation KBRFuseMountInfo
@end

@implementation KBRFuseStatus
+ (NSValueTransformer *)mountInfosJSONTransformer { return [MTLJSONAdapter arrayTransformerWithModelClass:KBRFuseMountInfo.class]; }
@end
