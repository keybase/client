//
//  KBProveInstructionsView.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveInstructionsView.h"

#import "AppDelegate.h"

@implementation KBProveInstructionsView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];
  
  _instructionsLabel = [[KBLabel alloc] init];
  [self addSubview:_instructionsLabel];

  _proofView = [[KBTextView alloc] init];
  _proofView.borderType = NSBezelBorder;
  _proofView.view.editable = NO;
  [self addSubview:_proofView];

  YOView *bottomView = [[YOView alloc] init];
  [self addSubview:bottomView];

  GHWeakSelf gself = self;
  _clipboardCopyButton = [KBButton buttonWithText:@"Copy to clipboard" style:KBButtonStyleLink];
  _clipboardCopyButton.targetBlock = ^{
    [NSPasteboard.generalPasteboard clearContents];
    BOOL pasted = [NSPasteboard.generalPasteboard writeObjects:@[gself.proofText]];
    DDLogDebug(@"Pasted? %@", @(pasted));
  };
  [bottomView addSubview:_clipboardCopyButton];

  _button = [KBButton buttonWithText:@"OK, I posted it." style:KBButtonStylePrimary];
  [bottomView addSubview:_button];

  YOSelf yself = self;
  bottomView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.clipboardCopyButton].size.height + 30;
    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, 0) view:yself.button].size.height + 20;
    return CGSizeMake(size.width, y);
  }];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_proofView topView:_instructionsLabel bottomView:bottomView insets:UIEdgeInsetsMake(20, 40, 20, 40) spacing:20 maxSize:CGSizeMake(600, 600)]];
}

- (NSString *)stringByStrippingHTML:(NSString *)str {
  NSRange r;
  while ((r = [str rangeOfString:@"<[^>]+>" options:NSRegularExpressionSearch]).location != NSNotFound)
    str = [str stringByReplacingCharactersInRange:r withString:@""];
  return str;
}

- (NSString *)instructionsForProveType:(KBProveType)proveType instructions:(KBRText *)instructions {
  return NSStringWithFormat(@"%@:", [self stringByStrippingHTML:instructions.data]);
}

- (void)setInstructions:(KBRText *)instructions proofText:(NSString *)proofText proveType:(KBProveType)proveType {
  [self.instructionsLabel setText:[self instructionsForProveType:proveType instructions:instructions] style:KBTextStyleDefault];

  _proofText = proofText;
  [self.proofView setText:proofText style:KBTextStyleDefault];
  [self setNeedsLayout];
}

@end
