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
  _proofView.view.textContainerInset = CGSizeMake(10, 10);
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

  YOHBox *buttonsView = [YOHBox box:@{@"spacing": @(20), @"horizontalAlignment": @"center", @"minSize": @"160,0"}];
  [bottomView addSubview:buttonsView];

  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  [buttonsView addSubview:_cancelButton];

  _deleteButton = [KBButton buttonWithText:@"Remove" style:KBButtonStyleDanger];
  [buttonsView addSubview:_deleteButton];

  _button = [KBButton buttonWithText:@"OK, I posted it." style:KBButtonStylePrimary];
  [buttonsView addSubview:_button];


  YOSelf yself = self;
  bottomView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.clipboardCopyButton].size.height + 30;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:buttonsView].size.height + 20;
    return CGSizeMake(size.width, y);
  }];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_proofView top:@[_instructionsLabel] bottom:@[bottomView] insets:UIEdgeInsetsMake(20, 40, 20, 40) spacing:20];
}

- (NSString *)instructionsForProveType:(KBProveType)proveType instructions:(KBRText *)instructions {
  return KBNSStringByStrippingHTML(instructions.data);
}

- (void)setInstructions:(KBRText *)instructions proofText:(NSString *)proofText proveType:(KBProveType)proveType {
  [self.instructionsLabel setText:[self instructionsForProveType:proveType instructions:instructions] style:KBTextStyleDefault];

  _proofText = proofText;
  [self.proofView setText:proofText style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
  [self setNeedsLayout];
}

@end
