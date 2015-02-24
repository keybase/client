//
//  KBMenuBar.m
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBMenuBar.h"
#import "KBLabel.h"
#import "KBBox.h"
#import "KBButton.h"
#import "KBAppearance.h"

@interface KBMenuBar ()
@property KBButton *backButton;
@property KBBox *border;
@end

@implementation KBMenuBar

- (void)viewInit {
  [super viewInit];

  self.wantsLayer = YES;
  self.layer.backgroundColor = [NSColor colorWithWhite:254.0/255.0 alpha:1.0].CGColor;

  _backButton = [KBButton buttonWithText:@"Back" style:KBButtonStyleLink];
  [self addSubview:_backButton];
//  _backView = [KBButton buttonWithImage:[NSImage imageNamed:@"46-Arrows-white-arrow-65-30"]];
//  [self addSubview:_backView];

  _border = [KBBox lineWithWidth:1.0 color:[NSColor colorWithWhite:225.0/255.0 alpha:1.0]];
  [self addSubview:_border];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout setFrame:CGRectMake(10, 0, size.width, size.height) view:yself.backButton];
    [layout setFrame:CGRectMake(0, size.height - 1, size.width, 1) view:yself.border];
    return CGSizeMake(size.width, size.height);
  }];
}

- (void)setBackTitle:(NSString *)backTitle targetBlock:(KBButtonTargetBlock)targetBlock {
  [_backButton setText:backTitle font:[KBAppearance.currentAppearance textFont] color:[KBAppearance.currentAppearance selectColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  _backButton.targetBlock = targetBlock;
  [self setNeedsLayout];
}

@end
