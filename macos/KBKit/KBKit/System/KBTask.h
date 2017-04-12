//
//  KBTask.h
//  KBKit
//
//  Created by Gabriel on 11/3/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef void (^KBTaskCompletion)(NSError *error, NSData *outData, NSData *errData);

@interface KBTask : NSObject

+ (void)execute:(NSString *)command args:(NSArray *)args timeout:(NSTimeInterval)timeout completion:(KBTaskCompletion)completion;

// Execute and parse JSON from stdout (otherwise error)
+ (void)executeForJSONWithCommand:(NSString *)command args:(NSArray *)args timeout:(NSTimeInterval)timeout completion:(void (^)(NSError *error, id value))completion;

@end
