//
//  KBSecretWordsInputView.m
//  Keybase
//
//  Created by Gabriel on 3/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDeviceAddView.h"

#import "KBDefines.h"
#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBDeviceAddView ()
@property KBTextView *inputField;
@property NSNumber *sessionId;

@property KBButton *addButton;
@property KBButton *cancelButton;
@end

@implementation KBDeviceAddView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];
  
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
  NSFont *inputFont = [NSFont fontWithName:@"Monaco" size:20];
  _inputField.view.font = inputFont;
  _inputField.onPaste = ^BOOL(KBTextView *textView) {
    NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];
    NSString *str = [pasteboard stringForType:NSPasteboardTypeString];
    [textView setText:str font:inputFont color:nil];
    return NO;
  };
  [contentView addSubview:_inputField];

  YOHBox *footerView = [YOHBox box:@{@"spacing": @(20), @"minSize": @"130,0", @"horizontalAlignment": @"center"}];
  [contentView addSubview:footerView];
  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  _cancelButton.targetBlock = ^{
    //[gself cancelDeviceAdd];
  };
  [footerView addSubview:_cancelButton];
  _addButton = [KBButton buttonWithText:@"OK" style:KBButtonStylePrimary];
  _addButton.targetBlock = ^{
    //[gself save];
  };
  [_addButton setKeyEquivalent:@"\r"];
  [footerView addSubview:_addButton];

  YOSelf yself = self;
  contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:header].size.height + 20;
    y += [layout centerWithSize:CGSizeMake(400, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:label].size.height + 30;

    y += [layout centerWithSize:CGSizeMake(400, 100) frame:CGRectMake(40, y, size.width - 80, 100) view:yself.inputField].size.height + 40;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:footerView].size.height + 20;

    return CGSizeMake(MIN(480, size.width), y);
  }];

  self.viewLayout = [YOLayout center:contentView];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window recalculateKeyViewLoop];
  [self.window makeFirstResponder:_inputField];
}

/*
- (void)cancelDeviceAdd {
  if (!_sessionId) {
    [self close:NO];
    return;
  }
  GHWeakSelf gself = self;
  [KBActivity setProgressEnabled:YES sender:self];
  KBRDeviceRequest *request = [[KBRDeviceRequest alloc] initWithClient:self.client];
  if (_sessionId) request.sessionId = _sessionId;
  [request deviceAddCancel:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if (error) [KBActivity setError:error sender:self];
    gself.sessionId = nil;
    [self close:NO];
  }];
}

- (void)save {
  NSString *secretWords = self.inputField.text;

  if ([NSString gh_isBlank:secretWords]) {
    [KBActivity setError:KBErrorAlert(@"You need to enter something.") sender:_inputField];
    return;
  }

  KBRDeviceRequest *request = [[KBRDeviceRequest alloc] initWithClient:self.client];

  [self.client registerMethod:@"keybase.1.locksmithUi.kexStatus" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRKexStatusRequestParams *requestParams = [[KBRKexStatusRequestParams alloc] initWithParams:params];
    DDLogDebug(@"Kex status: %@", requestParams.msg);
    completion(nil, nil);
  }];

  GHWeakSelf gself = self;
  [KBActivity setProgressEnabled:YES sender:self except:@[_cancelButton]];
  _sessionId = request.sessionId;
  [request deviceAddWithSecretPhrase:secretWords completion:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self except:@[gself.cancelButton]];
    if (error) {
      [KBActivity setError:error sender:self];
      return;
    }

    [self close:YES];
  }];
}
 */

- (void)close:(BOOL)added {
  self.completion(self, YES);
  [self.window close];
}

- (void)openInWindow:(KBWindow *)window {
  [window addModalWindowForView:self rect:CGRectMake(0, 0, 620, 420)];
}

@end
