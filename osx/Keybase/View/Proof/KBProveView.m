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
#import "KBProveType.h"

@interface KBProveView ()
@property NSString *serviceUsername;
@property (nonatomic) KBRProofType proveType;
@property NSString *sigID;
@property (copy) KBProveCompletion completion;
@end

@implementation KBProveView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  GHWeakSelf gself = self;

  _inputView = [[KBProveInputView alloc] init];
  _inputView.button.targetBlock = ^{ [gself startProof]; };
  [self addSubview:_inputView];

  _instructionsView = [[KBProveInstructionsView alloc] init];
  _instructionsView.button.targetBlock = ^{ [gself check]; };
  _instructionsView.cancelButton.targetBlock = ^{ [gself cancel]; };
  _instructionsView.hidden = YES;
  [self addSubview:_instructionsView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout centerWithSize:CGSizeMake(size.width, 0) frame:CGRectMake(0, 0, size.width, size.height) view:yself.inputView];
    [layout setSize:size view:yself.instructionsView options:0];
    return size;
  }];
}

+ (void)connectWithProveType:(KBRProofType)proveType proofResult:(KBProofResult *)proofResult client:(KBRPClient *)client sender:(NSView *)sender completion:(KBProveCompletion)completion {
  KBProveView *proveView = [[KBProveView alloc] init];
  proveView.client = client;
  [proveView setProveType:proveType proofResult:proofResult];

  NSWindow *window = [sender.window kb_addChildWindowForView:proveView rect:CGRectMake(0, 0, 620, 420) position:KBWindowPositionCenter title:@"Keybase" fixed:YES makeKey:YES];

  KBProveCompletion close = ^(BOOL success) {
    [window close];
    completion(success);
  };
  proveView.completion = close;
  proveView.inputView.cancelButton.targetBlock = ^{ close(NO); };
}

- (void)setProveType:(KBRProofType)proveType proofResult:(KBProofResult *)proofResult {
  _proveType = proveType;
  [_inputView setProveType:proveType];

  if (proofResult.proof.sigID) {
    _sigID = proofResult.proof.sigID;
    [self check];
  } else {
    [self.window makeFirstResponder:_inputView.inputField];
  }
}

- (void)setProofText:(NSString *)proofText {
  [_instructionsView setProofText:proofText proveType:_proveType];
  [_instructionsView layoutView];

  // TODO Animate change
  self.inputView.hidden = YES;
  self.instructionsView.hidden = NO;
}

- (void)startProof {
  NSString *serviceUsername = [_inputView.inputField.text gh_strip];
  _serviceUsername = serviceUsername;

  if ([NSString gh_isBlank:_serviceUsername]) {
    // TODO Become first responder
    [AppDelegate setError:KBErrorAlert(@"You need to choose a username.") sender:_inputView];
    return;
  }

  NSString *service = KBServiceNameForProveType(self.proveType);
  NSAssert(service, @"No service");

  GHWeakSelf gself = self;

  KBRPClient *client = self.client;
  KBRProveRequest *request = [[KBRProveRequest alloc] initWithClient:client];

  [client registerMethod:@"keybase.1.proveUi.promptUsername" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    //NSString *prompt = params[0][@"prompt"];
    completion(nil, gself.inputView.inputField.text);
  }];

  [client registerMethod:@"keybase.1.proveUi.preProofWarning" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.proveUi.promptOverwrite" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
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

  [client registerMethod:@"keybase.1.proveUi.outputInstructions" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBROutputInstructionsRequestParams *requestParams = [[KBROutputInstructionsRequestParams alloc] initWithParams:params];
    NSString *proofText = requestParams.proof;

    [KBActivity setProgressEnabled:NO sender:self];
    [self setProofText:proofText];
    completion(nil, nil);
  }];

  [KBActivity setProgressEnabled:YES sender:self];
  [request startProofWithSessionID:request.sessionId service:service username:_serviceUsername force:NO promptPosted:NO completion:^(NSError *error, KBRStartProofResult *startProofResult) {
    [KBActivity setProgressEnabled:NO sender:self];
    if (error) {
      [KBActivity setError:error sender:self];
      return;
    }
    gself.sigID = startProofResult.sigID;
  }];
}

- (void)cancel {
  NSString *sigID = _sigID;
  if (!sigID) {
    [KBActivity setError:KBMakeError(-1, @"Nothing to remove") sender:self];
    return;
  }

  GHWeakSelf gself = self;
  [KBActivity setProgressEnabled:YES sender:self];
  KBRRevokeRequest *request = [[KBRRevokeRequest alloc] initWithClient:self.client];
  [request revokeSigsWithSessionID:request.sessionId ids:@[sigID] seqnos:nil completion:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    gself.completion(NO);
  }];
}

- (void)check {
  NSString *sigID = _sigID;
  KBRProveRequest *request = [[KBRProveRequest alloc] initWithClient:self.client];
  [KBActivity setProgressEnabled:YES sender:self];
  [request checkProofWithSessionID:request.sessionId sigID:sigID completion:^(NSError *error, KBRCheckProofStatus *checkProofStatus) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;

    [self setProofText:checkProofStatus.proofText];

    if (checkProofStatus.found) {
      self.completion(NO);
    }
  }];
}

@end


