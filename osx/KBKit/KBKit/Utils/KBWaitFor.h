//
//  KBWaitFor.h
//  Keybase
//
//  Created by Gabriel on 5/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef void (^KBWaitForCheck)(BOOL abort, id obj);
typedef void (^KBWaitForBlock)(KBWaitForCheck check);

typedef void (^KBWaitForCompletion)(id obj);

@interface KBWaitFor : NSObject

+ (void)waitFor:(KBWaitForBlock)block delay:(NSTimeInterval)delay timeout:(NSTimeInterval)timeout label:(NSString *)label completion:(KBWaitForCompletion)completion;

@end
