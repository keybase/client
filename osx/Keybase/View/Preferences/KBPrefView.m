//
//  KBPrefView.m
//  Keybase
//
//  Created by Gabriel on 4/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefView.h"

@implementation KBPrefView

- (instancetype)initWithPreferences:(KBPreferences *)preferences {
  if ((self = [super init])) {
    _preferences = preferences;
  }
  return self;
}

@end
