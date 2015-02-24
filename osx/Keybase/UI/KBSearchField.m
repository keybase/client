//
//  KBSearchField.m
//  Keybase
//
//  Created by Gabriel on 2/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSearchField.h"

@implementation KBSearchField

- (void)mouseDown:(NSEvent *)event {
  [self selectText:self];

  [super mouseDown:event];
}

@end
