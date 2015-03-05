//
//  KBContentView.m
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBContentView.h"

#import "KBLayouts.h"

@interface KBContentView ()
@property (nonatomic) KBView *contentView;
@end

@implementation KBContentView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  self.layer.backgroundColor = NSColor.whiteColor.CGColor;
}

- (KBView *)contentView {
  if (!_contentView) {
    _contentView = [[KBView alloc] init];
    [self addSubview:_contentView];
    if (!self.viewLayout) {
      self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts center:_contentView]];
    }
  }
  return _contentView;
}

@end
