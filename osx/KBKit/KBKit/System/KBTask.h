//
//  KBTask.h
//  KBKit
//
//  Created by Gabriel on 11/3/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface KBTask : NSObject

+ (void)execute:(NSString *)command args:(NSArray *)args completion:(void (^)(NSError *error, NSData *outData, NSData *errData))completion;

@end
