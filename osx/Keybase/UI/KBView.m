//
//  KBView.m
//  Keybase
//
//  Created by Gabriel on 3/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBView.h"

#import "KBLayouts.h"

@interface KBView ()
@property (nonatomic) YONSView *contentView;
@end

@implementation KBView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  self.layer.backgroundColor = NSColor.whiteColor.CGColor;
}

- (YONSView *)contentView {
  if (!_contentView) {
    _contentView = [[YONSView alloc] init];
    [self addSubview:_contentView];
    if (!self.viewLayout) {
      self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts center:_contentView]];
    }
  }
  return _contentView;
}

@end
