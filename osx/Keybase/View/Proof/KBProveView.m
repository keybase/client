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
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  GHWeakSelf gself = self;

  _inputView = [[KBProveInputView alloc] init];
  _inputView.button.targetBlock = ^{
    [gself generateProof];
  };
  [self addSubview:_inputView];

  _instructionsView = [[KBProveInstructionsView alloc] init];
  _instructionsView.button.targetBlock = ^{
    [gself check];
  };
  _instructionsView.hidden = YES;
  [self addSubview:_instructionsView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout centerWithSize:CGSizeMake(size.width, 0) frame:CGRectMake(0, 0, size.width, size.height) view:yself.inputView];
    [layout setSize:size view:yself.instructionsView options:0];
    return size;
  }];
}

+ (void)connectWithProveType:(KBProveType)proveType client:(KBRPClient *)client sender:(NSView *)sender completion:(KBProveCompletion)completion {
  KBProveView *proveView = [[KBProveView alloc] init];
  proveView.client = client;
  proveView.proveType = proveType;

  NSWindow *window = [sender.window kb_addChildWindowForView:proveView rect:CGRectMake(0, 0, 420, 420) position:KBWindowPositionCenter title:@"Keybase" fixed:YES makeKey:YES];

  proveView.inputView.cancelButton.targetBlock = ^{
    [window close];
  };
}

- (void)setProveType:(KBProveType)proveType {
  _proveType = proveType;
  [_inputView setProveType:proveType];

  [self.window makeFirstResponder:_inputView.inputField];
}

- (void)setInstructions:(KBRText *)instructions proofText:(NSString *)proofText {
  [_instructionsView setInstructions:instructions proofText:proofText proveType:_proveType];
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

  KBRPClient *client = self.client;
  KBRProveRequest *prove = [[KBRProveRequest alloc] initWithClient:client];

  [client registerMethod:@"keybase.1.proveUi.promptUsername" sessionId:prove.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    //NSString *prompt = params[0][@"prompt"];
    completion(nil, gself.inputView.inputField.text);
  }];

  [client registerMethod:@"keybase.1.proveUi.preProofWarning" sessionId:prove.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.proveUi.okToCheck" sessionId:prove.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
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

  [client registerMethod:@"keybase.1.proveUi.promptOverwrite" sessionId:prove.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
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

  [client registerMethod:@"keybase.1.proveUi.outputInstructions" sessionId:prove.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBROutputInstructionsRequestParams *requestParams = [[KBROutputInstructionsRequestParams alloc] initWithParams:params];
    KBRText *instructions = requestParams.instructions;
    NSString *proof = requestParams.proof;

    [self.navigation setProgressEnabled:NO];
    [self setInstructions:instructions proofText:proof];
    completion(nil, nil);
  }];

  [self.navigation setProgressEnabled:YES];
  [prove proveWithSessionID:prove.sessionId service:service username:userName force:NO completion:^(NSError *error) {
    [self.navigation setProgressEnabled:NO];
    if (error) {
      [AppDelegate setError:error sender:gself.inputView];
      return;
    }
    self.completion(NO);
  }];
}

- (void)check {
  KBDebugAlert(@"TODO", self.window);
}

@end


