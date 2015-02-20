//
//  KBGPGKeyView.m
//  Keybase
//
//  Created by Gabriel on 2/17/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBGPGKeyView.h"

@interface KBGPGKeyView ()
@property KBLabel *nameLabel;
@property KBBox *border;
@end

@implementation KBGPGKeyView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  [self.layer setBackgroundColor:NSColor.clearColor.CGColor];

  _nameLabel = [[KBLabel alloc] init];
  _nameLabel.verticalAlignment = KBVerticalAlignmentMiddle;
  [self addSubview:_nameLabel];

  _border = [KBBox lineWithWidth:1.0 color:[KBAppearance.currentAppearance lineColor]];
  [self addSubview:_border];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 10;

    y += [layout setFrame:CGRectMake(x, y, size.width - x, 40) view:yself.nameLabel].size.height;
    [layout setFrame:CGRectMake(0, y - 0.5, size.width, 1) view:yself.border];

    return CGSizeMake(size.width, y);
  }];
}

- (void)setGPGKey:(KBRGPGKey *)GPGKey {
  //[self.nameLabel setText:user.username font:[NSFont boldSystemFontOfSize:16] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
  [self setNeedsLayout];
}

@end
