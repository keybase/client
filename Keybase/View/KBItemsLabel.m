//
//  KBItemsLabel.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBItemsLabel.h"

@interface KBItemsLabel ()
@property KBTextLabel *headerLabel;
@property NSMutableArray *textLabels;
@end

@implementation KBItemsLabel

- (void)viewInit {
  [super viewInit];
  _headerLabel = [[KBTextLabel alloc] init];
  [self addSubview:_headerLabel];

  _textLabels = [NSMutableArray array];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 15;
    CGFloat y = 10;

    if (yself.headerLabel.attributedText.length > 0) {
      y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 5, 0) view:yself.headerLabel].size.height;
    }

    for (NSView *view in yself.textLabels) {
      y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 5, 0) view:view].size.height;
    }

    y += 2;

    return CGSizeMake(size.width, y);
  }];
}

- (void)addLabelWithText:(NSString *)text font:(NSFont *)font tag:(NSUInteger)tag targetBlock:(void (^)(id sender))targetBlock {
  KBButton *button = [KBButton buttonAsLinkWithText:text];
  [_textLabels addObject:button];
  [self addSubview:button];
}

- (void)addLabelWithPlaceHolder:(NSString *)placeHolder font:(NSFont *)font tag:(NSUInteger)tag targetBlock:(void (^)(id sender))targetBlock {
  KBButton *button = [KBButton buttonAsLinkWithText:placeHolder];
  [_textLabels addObject:button];
  [self addSubview:button];
}

- (void)clearLabels {
  for (NSView *view in _textLabels) [view removeFromSuperview];
  [_textLabels removeAllObjects];
}

- (void)setHeaderText:(NSString *)headerText items:(NSArray *)items texts:(NSArray *)texts font:(NSFont *)font placeHolder:(NSString *)placeHolder targetBlock:(void (^)(id sender, id object))targetBlock {
  NSAssert(NO, @"TODO");
  if (headerText) {
    //_headerLabel.text = headerText;
    _headerLabel.hidden = NO;
  } else {
    //_headerLabel.text = nil;
    _headerLabel.hidden = YES;
  }

  [self clearLabels];
  GHWeakSelf blockSelf = self;
  if ([items count] == 0) {
    [self addLabelWithPlaceHolder:placeHolder font:font tag:-1 targetBlock:^(id sender) { targetBlock(blockSelf, nil); }];
  } else {
    for (NSInteger index = 0; index < [items count]; index++) {
      [self addLabelWithText:texts[index] font:font tag:index targetBlock:^(id sender) { targetBlock(blockSelf, items[index]); }];
    }
  }

  [self setNeedsLayout];
}

@end
