//
//  KBProveInstructionsView.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveInstructionsView.h"

#import "AppDelegate.h"
#import "KBProveType.h"

@interface KBProveInstructionsView ()
@property KBLabel *instructionsLabel;
@property KBTextView *proofView;
@property KBButton *clipboardCopyButton;
@property NSString *proofText;
@end

@implementation KBProveInstructionsView

@synthesize cancelButton=_cancelButton, button=_button;

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

  YOVBox *bottomView = [YOVBox box:@{@"spacing": @(20)}];
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

  _cancelButton = [KBButton buttonWithText:@"No, Thanks" style:KBButtonStyleDefault];
  [buttonsView addSubview:_cancelButton];

  _button = [KBButton buttonWithText:@"OK, I posted it." style:KBButtonStylePrimary];
  [buttonsView addSubview:_button];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_proofView top:@[_instructionsLabel] bottom:@[bottomView] insets:UIEdgeInsetsMake(20, 40, 20, 40) spacing:20];
}

- (NSString *)instructionsForServiceName:(NSString *)serviceName {
  NSString *name = KBNameForServiceName(serviceName);
  return name ? NSStringWithFormat(@"Post the following to %@:", name) : @"Post the following:";
}

- (void)setProofText:(NSString *)proofText serviceName:(NSString *)serviceName {
  [self.instructionsLabel setText:[self instructionsForServiceName:serviceName] style:KBTextStyleDefault];

  _proofText = proofText;
  [self.proofView setText:proofText style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
  [self setNeedsLayout];
}

@end
