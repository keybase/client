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
@property NSMutableArray *outputs;
@end

@implementation KBRunOver

- (void)next:(id)input {
  if (!input) {
    self.completion(self.outputs);
    return;
  }

  GHWeakSelf gself = self;
  self.runBlock(input, ^(id output) {
    NSAssert(output, @"You need an output");
    [gself.outputs addObject:output];
    [self next:[gself.enumerator nextObject]];
  });
}

- (void)run {
  _outputs = [NSMutableArray array];
  [self next:[_enumerator nextObject]];
}

@end