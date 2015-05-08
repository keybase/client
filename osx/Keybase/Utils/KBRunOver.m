//
//  KBRunOver.m
//  Keybase
//
//  Created by Gabriel on 4/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBRunOver.h"

#import <GHKit/GHKit.h>

@interface KBRunOver ()
@property NSInteger index;

@property NSMutableArray *outputs;
@end

@implementation KBRunOver

- (void)next {
  GHWeakSelf gself = self;
  id input = _objects[_index++];
  self.runBlock(input, ^(id output) {
    [gself.outputs addObject:output];
    if (gself.index < [gself.objects count]) {
      // Maybe dispatch_async so we don't blow the stack? But how do we know the current queue so..
      [self next];
    } else {
      self.completion(self.outputs);
    }
  });
}

// Untested
- (void)run:(dispatch_queue_t)queue {
  GHWeakSelf gself = self;
  _outputs = [NSMutableArray array];
  __block NSInteger count = 0;
  NSInteger objectCount = [_objects count];
  for (NSInteger i = 0; i < [_objects count]; i++) {
    id input = _objects[i];
    dispatch_async(queue, ^{
      self.runBlock(input, ^(id output) {
        [gself.outputs addObject:output];
        if (++count == objectCount) {
          self.completion(gself.outputs);
        }
      });
    });
  }
}


- (void)run {
  if ([_objects count] == 0) {
    self.completion(@[]);
    return;
  }

  _outputs = [NSMutableArray array];
  [self next];
}

@end