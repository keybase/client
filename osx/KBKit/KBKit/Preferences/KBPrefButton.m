//
//  KBPrefButton.m
//  Keybase
//
//  Created by Gabriel on 4/7/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefButton.h"
#import <Tikppa/Tikppa.h>

@interface KBPrefButton ()
@property KBLabel *categoryLabel; // Optional
@property KBButton *button;
@property id<KBPreferences> preferences;
@end

@implementation KBPrefButton

- (void)viewInit {
  [super viewInit];
  _inset = 140;

  _categoryLabel = [[KBLabel alloc] init];
  [self addSubview:_categoryLabel];

  _button = [KBButton button];
  [self addSubview:_button];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 0;
    CGFloat y = 0;
    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, y + 5, yself.inset, 0) view:yself.categoryLabel].size.width + 10;

    y += [layout sizeToFitInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.button].size.height;
    return CGSizeMake(size.width, y);
  }];
}

- (void)setCategory:(NSString *)category {
  [_categoryLabel setText:category style:KBTextStyleDefault alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
}

- (void)setButtonText:(NSString *)buttonText targetBlock:(dispatch_block_t)targetBlock {
  [_button setText:buttonText style:KBButtonStyleDefault options:KBButtonOptionsToolbar alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByClipping];
  _button.targetBlock = targetBlock;
  [self setNeedsLayout];
}

@end
