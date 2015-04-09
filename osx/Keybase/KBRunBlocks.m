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
  self.runBlock(_objects[_index++], ^(NSError *error) {
    if (error) [gself.errors addObject:error];
    if (gself.index < [gself.objects count]) {
      // Maybe dispatch_async so we don't blow the stack? But how do we know the current queue so..
      [self next];
    } else {
      self.completionBlock(gself.errors, gself.objects);
    }
  });
}

// Untested
- (void)run:(dispatch_queue_t)queue {
  GHWeakSelf gself = self;
  _errors = [NSMutableArray array];
  __block NSInteger count = 0;
  NSInteger objectCount = [_objects count];
  for (NSInteger i = 0; i < [_objects count]; i++) {
    id obj = _objects[i];
    dispatch_async(queue, ^{
      self.runBlock(obj, ^(NSError *error) {
        if (error) [gself.errors addObject:error];
        if (++count == objectCount) {
          self.completionBlock(gself.errors, gself.objects);
        }
      });
    });
  }
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