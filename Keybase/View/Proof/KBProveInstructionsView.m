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
  self.wantsLayer = YES;
  self.layer.backgroundColor = NSColor.whiteColor.CGColor;

  _instructionsLabel = [[KBLabel alloc] init];
  [self addSubview:_instructionsLabel];

  _proofLabel = [[KBLabel alloc] init];
  _proofLabel.selectable = YES;

  _scrollView = [[KBScrollView alloc] init];
  [_scrollView setDocumentView:_proofLabel];
  _scrollView.scrollView.borderType = NSBezelBorder;
  [self addSubview:_scrollView];

  YONSView *bottomView = [[YONSView alloc] init];
  [self addSubview:bottomView];

  GHWeakSelf gself = self;
  _clipboardCopyButton = [KBButton buttonWithText:@"Copy to clipboard" style:KBButtonStyleLink];
  _clipboardCopyButton.targetBlock = ^{
    [NSPasteboard.generalPasteboard clearContents];
    BOOL pasted = [NSPasteboard.generalPasteboard writeObjects:@[gself.proofText]];
    GHDebug(@"Pasted? %@", @(pasted));
  };
  [bottomView addSubview:_clipboardCopyButton];

  _button = [KBButton buttonWithText:@"OK, I posted it." style:KBButtonStylePrimary];
  [bottomView addSubview:_button];

  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleLink];
  [bottomView addSubview:_cancelButton];

  YOSelf yself = self;
  bottomView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.clipboardCopyButton].size.height + 30;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.button].size.height + 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.cancelButton].size.height;
    return CGSizeMake(size.width, y);
  }];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_scrollView topView:_instructionsLabel bottomView:bottomView margin:UIEdgeInsetsMake(20, 40, 20, 40) padding:20]];
}

- (void)setInstructions:(KBRText *)instructions proofText:(NSString *)proofText {
  // TODO Check instructions.markup
  self.instructionsLabel.attributedText = [KBLabel parseMarkup:instructions.data font:[KBAppearance.currentAppearance textFont] color:[KBAppearance.currentAppearance textColor]];

  _proofText = proofText;
  [self.proofLabel setText:proofText font:[KBAppearance.currentAppearance textFont] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
  [self setNeedsLayout];
}

@end
