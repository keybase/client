//
//  KBView.m
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBView.h"
#import "KBAppearance.h"

@implementation KBView

- (void)viewInit {
  [super viewInit];
  self.backgroundColor = KBAppearance.currentAppearance.backgroundColor;
}

- (BOOL)wantsDefaultClipping {
  return _clipToBounds;
}

- (void)setBackgroundColor:(NSColor *)backgroundColor {
  _backgroundColor = backgroundColor;
  self.wantsLayer = YES;
  self.layer.backgroundColor = backgroundColor.CGColor;
}

@end
