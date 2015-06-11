//
//  KBWaitFor.m
//  Keybase
//
//  Created by Gabriel on 5/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBWaitFor.h"
#import "KBDefines.h"
#import <CocoaLumberjack/CocoaLumberjack.h>

@implementation KBWaitFor

+ (void)waitFor:(KBWaitForBlock)block delay:(NSTimeInterval)delay timeout:(NSTimeInterval)timeout label:(NSString *)label completion:(KBWaitForCompletion)completion {

  [self waitFor:block delay:delay until:[NSDate dateWithTimeIntervalSinceNow:timeout] label:label completion:completion];
}

+ (void)waitFor:(KBWaitForBlock)block delay:(NSTimeInterval)delay until:(NSDate *)until label:(NSString *)label completion:(KBWaitForCompletion)completion {
  block(^(BOOL abort, id obj) {
    if (abort || obj) {
      completion(obj);
    } else {
      if (NSDate.date.timeIntervalSince1970 >= until.timeIntervalSince1970) {
        completion(nil);
      } else {
        DDLogDebug(@"Waiting (%@)", label);
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
          [self waitFor:block delay:delay until:until label:label completion:completion];
        });
      }
    }
  });
}

@end
