//
//  KBSecretWordsInputView.m
//  Keybase
//
//  Created by Gabriel on 3/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDeviceAddView.h"
#import "AppDelegate.h"

@interface KBDeviceAddView ()
@property KBTextView *inputField;
@property KBRDeviceRequest *request;
@end

@implementation KBDeviceAddView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];
  
  GHWeakSelf gself = self;

  YOView *contentView = [[YOView alloc] init];
  [self addSubview:contentView];

  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Add a Device" style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [contentView addSubview:header];

  KBLabel *label = [[KBLabel alloc] init];
  [label setText:@"On another device, you should have been presented with a secret passphrase to type here." style:KBTextStyleDefault];
  [contentView addSubview:label];

  _inputField = [[KBTextView alloc] init];
  _inputField.borderType = NSBezelBorder;
  _inputField.view.font = [NSFont fontWithName:@"Monaco" size:20];
  [contentView addSubview:_inputField];

  YOHBox *footerView = [YOHBox box:@{@"spacing": @(20), @"minSize": @"130,0", @"horizontalAlignment": @"center"}];
  [contentView addSubview:footerView];
  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  _cancelButton.targetBlock = ^{ [gself cancelDeviceAdd]; };
  [footerView addSubview:_cancelButton];
  KBButton *button = [KBButton buttonWithText:@"OK" style:KBButtonStylePrimary];
  button.targetBlock = ^{ [gself save]; };
  [button setKeyEquivalent:@"\r"];
  [footerView addSubview:button];


  YOSelf yself = self;
  contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:header].size.height + 20;
    y += [layout centerWithSize:CGSizeMake(400, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:label].size.height + 30;

    y += [layout centerWithSize:CGSizeMake(400, 100) frame:CGRectMake(40, y, size.width - 80, 100) view:yself.inputField].size.height + 40;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:footerView].size.height + 20;

    return CGSizeMake(MIN(480, size.width), y);
  }];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts center:contentView]];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window recalculateKeyViewLoop];
  [self.window makeFirstResponder:_inputField];
}

- (void)cancelDeviceAdd {
  if (!_request) {
    self.completion(NO);
    return;
  }
  KBRDeviceRequest *request = [[KBRDeviceRequest alloc] init];
  [request deviceAddCancelWithSessionID:_request.sessionId completion:^(NSError *error) {
    if (error) [AppDelegate setError:error sender:self];
    self.completion(NO);
  }];
}

- (void)save {
  NSString *secretWords = self.inputField.text;

  if ([NSString gh_isBlank:secretWords]) {
    [AppDelegate setError:KBErrorAlert(@"You need to enter something.") sender:_inputField];
    return;
  }

  _request = [[KBRDeviceRequest alloc] initWithClient:self.client];

  [self.client registerMethod:@"keybase.1.locksmithUi.kexStatus" sessionId:_request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRKexStatusRequestParams *requestParams = [[KBRKexStatusRequestParams alloc] initWithParams:params];
    DDLogDebug(@"Kex status: %@", requestParams.msg);
    completion(nil, nil);
  }];

  [KBActivity setProgressEnabled:YES sender:self];
  [_request deviceAddWithSessionID:_request.sessionId secretPhrase:secretWords completion:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if (error) {
      [KBActivity setError:error sender:self];
      return;
    }

    self.completion(YES);
  }];
}

@end