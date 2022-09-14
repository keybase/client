//
//  ItemProviderHelper.h
//  Keybase
//
//  Created by Chris Nojima on 9/13/22.
//  Copyright © 2022 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ItemProviderHelper : NSObject
-(id) initForShare: (BOOL) isShare withItems: (NSArray*) items attrString: (NSString *) ats completionHandler:(void (^)(void))handler;
-(void) startProcessing;
@property (nonatomic, strong) NSMutableArray * manifest;
@end

NS_ASSUME_NONNULL_END
