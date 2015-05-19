//
//  KBTask.h
//  Keybase
//
//  Created by Gabriel on 5/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBTask : NSObject

+ (void)execute:(NSString *)command args:(NSArray *)args completion:(void (^)(NSError *error, NSString *output))completion;

@end
