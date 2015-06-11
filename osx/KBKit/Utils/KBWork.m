//
//  KBWork.m
//  Keybase
//
//  Created by Gabriel on 4/24/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBWork.h"

@interface KBWork ()
@property id input;
@property id output;
@property NSError *error;
@end

@implementation KBWork

+ (instancetype)workWithInput:(id)input output:(id)output error:(NSError *)error {
  KBWork *run = [[self.class alloc] init];
  run.input = input;
  run.output = output;
  run.error = error;
  return run;
}

@end