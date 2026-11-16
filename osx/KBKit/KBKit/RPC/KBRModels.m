//
//  KBRModels.m
//  KBKit
//

#import "KBRModels.h"

@implementation KBRStringKVPair
@end

@implementation KBRStatus
+ (NSValueTransformer *)fieldsJSONTransformer { return [MTLJSONAdapter arrayTransformerWithModelClass:KBRStringKVPair.class]; }
@end

@implementation KBRServiceStatus
@end

@implementation KBRFuseMountInfo
@end

@implementation KBRFuseStatus
+ (NSValueTransformer *)mountInfosJSONTransformer { return [MTLJSONAdapter arrayTransformerWithModelClass:KBRFuseMountInfo.class]; }
@end
