//
//  KBPrefGeneralView.m
//  Keybase
//
//  Created by Gabriel on 4/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefGeneralView.h"

@implementation KBPrefGeneralView

- (instancetype)initWithPreferences:(KBPreferences *)preferences {
  if ((self = [super init])) {
    [self setOptions:@{@"spacing": @"10", @"insets": @"20,40,20,40"}];

  }
  return self;
}

@end
