//
//  KBTwitterView.m
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveView.h"

//#import <Accounts/Accounts.h>
//#import <Social/Social.h>
#import <Slash/Slash.h>

#import "AppDelegate.h"

@implementation KBProveView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  self.layer.backgroundColor = NSColor.whiteColor.CGColor;
  
  GHWeakSelf gself = self;

  _inputView = [[KBProveInputView alloc] init];
  _inputView.button.targetBlock = ^{
    [gself generateProof];
  };
  _inputView.cancelButton.targetBlock = ^{
    gself.completion(YES);
  };
  [self addSubview:_inputView];

  _instructionsView = [[KBProveInstructionsView alloc] init];
  _instructionsView.hidden = YES;
  _instructionsView.cancelButton.targetBlock = ^{
    gself.completion(YES);
  };
  [self addSubview:_instructionsView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout setFrame:CGRectMake(0, 40, size.width, size.height - 40) view:yself.inputView];
    [layout setFrame:CGRectMake(0, 20, size.width, size.height - 20) view:yself.instructionsView];
    return size;
  }];
}

+ (void)connectWithProveType:(KBProveType)proveType sender:(NSView *)sender completion:(KBProveCompletion)completion {
  KBProveView *proveView = [[KBProveView alloc] init];
  proveView.proveType = proveType;

  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:proveView title:NSStringWithFormat(@"Connect with %@", KBNameForProveType(proveType))];
  NSWindow *window = [KBWindow windowWithContentView:navigation size:CGSizeMake(420, 420) retain:NO];

  NSWindow *sourceWindow = sender.window ? sender.window : [NSApp mainWindow];
  [sourceWindow beginSheet:window completionHandler:^(NSModalResponse returnCode) {
    completion(returnCode == NSModalResponseCancel);
  }];

  proveView.completion = ^(BOOL canceled) {
    [sourceWindow endSheet:window returnCode:canceled ? NSModalResponseCancel : NSModalResponseContinue];
  };
}

- (void)setProveType:(KBProveType)proveType {
  _proveType = proveType;
  [_inputView setProveType:proveType];

  [self.window makeFirstResponder:_inputView.inputField];
}

- (void)setInstructions:(KBRText *)instructions proofText:(NSString *)proofText targetBlock:(dispatch_block_t)targetBlock {
  [_instructionsView setInstructions:instructions proofText:proofText];
  _instructionsView.button.targetBlock = targetBlock;
  [_instructionsView layoutView];

  // TODO Animate change
  self.inputView.hidden = YES;
  self.instructionsView.hidden = NO;
}

- (void)generateProof {
  NSString *userName = [_inputView.inputField.text gh_strip];

  if ([NSString gh_isBlank:userName]) {
    // TODO Become first responder
    [AppDelegate setError:KBErrorAlert(@"You need to choose a username.") sender:_inputView];
    return;
  }

  NSString *service = KBServiceNameForProveType(self.proveType);
  NSAssert(service, @"No service");

  GHWeakSelf gself = self;

  [AppDelegate.client registerMethod:@"keybase.1.proveUi.promptUsername" owner:self requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    //NSString *prompt = params[0][@"prompt"];
    completion(nil, gself.inputView.inputField.text);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.proveUi.preProofWarning" owner:self requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, nil);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.proveUi.okToCheck" owner:self requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBROkToCheckRequestParams *requestParams = [[KBROkToCheckRequestParams alloc] initWithParams:params];
    NSInteger attempt = requestParams.attempt;

    /*
     NSString *name = requestParams.name;
     NSString *prompt = NSStringWithFormat(@"Check %@%@?", name, attempt > 0 ? @" again" : @"");

     [KBAlert promptWithTitle:name description:prompt style:NSInformationalAlertStyle buttonTitles:@[@"OK", @"Cancel"] view:self completion:^(NSModalResponse response) {
     completion(nil, @(response == NSAlertFirstButtonReturn));
     }];
     */

    completion(nil, @(attempt == 0));
  }];

  [AppDelegate.client registerMethod:@"keybase.1.proveUi.promptOverwrite" owner:self requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRPromptOverwriteRequestParams *requestParams = [[KBRPromptOverwriteRequestParams alloc] initWithParams:params];
    NSString *account = requestParams.account;
    KBRPromptOverwriteType type = requestParams.typ;

    NSString *prompt;
    switch (type) {
      case KBRPromptOverwriteTypeSocial:
        prompt = NSStringWithFormat(@"You already have a proof for %@.", account);
        break;
      case KBRPromptOverwriteTypeSite:
        prompt = NSStringWithFormat(@"You already have claimed ownership of %@.", account);
        break;
    }

    [KBAlert promptWithTitle:@"Overwrite?" description:prompt style:NSWarningAlertStyle buttonTitles:@[NSStringWithFormat(@"Yes, Overwrite %@", account), @"Cancel"] view:self completion:^(NSModalResponse response) {
      completion(nil, @(response == NSAlertFirstButtonReturn));
    }];
  }];

  [AppDelegate.client registerMethod:@"keybase.1.proveUi.outputInstructions" owner:self requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBROutputInstructionsRequestParams *requestParams = [[KBROutputInstructionsRequestParams alloc] initWithParams:params];
    KBRText *instructions = requestParams.instructions;
    NSString *proof = requestParams.proof;

    [self.navigation setProgressEnabled:NO];
    [self setInstructions:instructions proofText:proof targetBlock:^{
      [gself.navigation setProgressEnabled:YES];
      completion(nil, @(YES));
    }];
  }];

  [self.navigation setProgressEnabled:YES];
  KBRProveRequest *prove = [[KBRProveRequest alloc] initWithClient:AppDelegate.client];
  [prove proveWithService:service username:userName force:NO completion:^(NSError *error) {
    [self.navigation setProgressEnabled:NO];
    [AppDelegate.client unregister:gself];
    if (error) {
      [AppDelegate setError:error sender:gself.inputView];
      return;
    }
    self.completion(NO);
  }];
}

@end


