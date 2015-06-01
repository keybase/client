//
//  KBProveRooterInstructions.m
//  Keybase
//
//  Created by Gabriel on 6/1/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveRooterInstructions.h"
#import "KBProveType.h"

@interface KBProveRooterInstructions ()
@property KBLabel *instructionsLabel;
@property KBTextView *proofView;
@end

@implementation KBProveRooterInstructions

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

  YOHBox *buttonsView = [YOHBox box:@{@"spacing": @(20), @"horizontalAlignment": @"center", @"minSize": @"160,0"}];
  [self addSubview:buttonsView];

  _cancelButton = [KBButton buttonWithText:@"No, Thanks" style:KBButtonStyleDefault];
  [buttonsView addSubview:_cancelButton];

  _button = [KBButton buttonWithText:@"OK, I posted it." style:KBButtonStylePrimary];
  [buttonsView addSubview:_button];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_proofView top:@[_instructionsLabel] bottom:@[buttonsView] insets:UIEdgeInsetsMake(20, 40, 20, 40) spacing:20];
}

- (void)setProofText:(NSString *)proofText proofType:(KBRProofType)proofType {
  NSAssert(proofType == KBRProofTypeRooter, @"Wrong proofType");

  [self.instructionsLabel setText:@"Open the link" style:KBTextStyleDefault];

  NSString *URLString = NSStringWithFormat(@"http://localhost:3000/_/api/1.0/rooter.json?post=%@", proofText);

  [self.proofView setText:URLString style:KBTextStyleDefault options:KBTextOptionsMonospace alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
  [self setNeedsLayout];
}

@end
