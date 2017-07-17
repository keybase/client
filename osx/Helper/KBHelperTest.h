//
//  KBHelperTest.h
//  Keybase
//
//  Created by Gabriel on 11/5/15.
//  Copyright © 2017 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBHelperTest : NSObject

- (void)test:(void (^)(NSError *error, id value))completion;

+ (int)test;

@end
