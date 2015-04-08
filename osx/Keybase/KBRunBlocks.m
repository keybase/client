//
//  KBRunBlocks.m
//  Keybase
//
//  Created by Gabriel on 4/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBRunBlocks.h"

#import <GHKit/GHKit.h>

@interface KBRunBlocks ()
@property NSInteger index;
@property NSMutableArray *errors;
@end

@implementation KBRunBlocks

- (void)next {
  GHWeakSelf gself = self;
  BOOL isLast = (_index + 1) == [_objects count];
  self.runBlock(_objects[_index++], isLast, ^(NSError *error) {
    if (error) [gself.errors addObject:error];
    if (gself.index < [gself.objects count]) {
      // Maybe dispatch_async so we don't blow the stack? But how do we know the current queue so..
      [self next];
    } else {
      self.completionBlock(gself.errors, gself.objects);
    }
  });
}

- (void)run {
  if ([_objects count] == 0) {
    self.completionBlock(@[], @[]);
    return;
  }

  _errors = [NSMutableArray array];
  [self next];
}

@end