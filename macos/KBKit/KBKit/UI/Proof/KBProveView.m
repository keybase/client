//
//  KBProveView.m
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveView.h"

#import "KBDefines.h"
#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBProveView ()
@property (nonatomic) NSString *serviceName;
@property (copy) KBProveCompletion completion;

@property KBProveInputView *inputView;

@property NSString *serviceUsername;
@property NSString *sigId;
@end

@implementation KBProveView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  GHWeakSelf gself = self;
  
  _inputView = [[KBProveInputView alloc] init];
  _inputView.button.targetBlock = ^{ [gself startProof]; };
  _inputView.cancelButton.targetBlock = ^{ [gself cancel]; };
  [self addSubview:_inputView];

  self.viewLayout = [YOLayout center:_inputView];
}

+ (void)createProofWithServiceName:(NSString *)serviceName client:(KBRPClient *)client sender:(id)sender completion:(KBProveCompletion)completion {
  [self _setServiceName:serviceName proofResult:nil client:client sender:sender completion:completion];
}

+ (void)replaceProof:(KBProofResult *)proofResult client:(KBRPClient *)client sender:(id)sender completion:(KBProveCompletion)completion {
  [self _setServiceName:nil proofResult:proofResult client:client sender:sender completion:completion];
}

+ (void)_setServiceName:(NSString *)serviceName proofResult:(KBProofResult *)proofResult client:(KBRPClient *)client sender:(id)sender completion:(KBProveCompletion)completion {
  KBProveView *proveView = [[KBProveView alloc] init];
  proveView.client = client;
  if (serviceName) [proveView setServiceName:serviceName];
  if (proofResult) [proveView setProofResult:proofResult];

  KBProveCompletion close = ^(id sender, BOOL success) {
    NSAssert([proveView.navigation window], @"No window?");
    [[proveView.navigation window] close];
    completion(sender, success);
  };
  proveView.completion = close;

  [[sender window] kb_addChildWindowForView:proveView rect:CGRectMake(0, 0, 620, 420) position:KBWindowPositionCenter title:@"" fixed:NO makeKey:YES];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window makeFirstResponder:_inputView.inputField];
}

// If creating
- (void)setServiceName:(NSString *)serviceName {
  _serviceName = serviceName;
  _serviceUsername = nil;
  _sigId = nil;
  [_inputView setServiceName:_serviceName];
  [self setNeedsLayout];
}

// If replacing
- (void)setProofResult:(KBProofResult *)proofResult {
  _serviceName = proofResult.proof.key;
  _serviceUsername = proofResult.proof.value;
  _sigId = proofResult.proof.sigID;

  [_inputView setServiceName:_serviceName];
  _inputView.inputField.text = _serviceUsername;

  [self setNeedsLayout];
}

- (void)openInstructionsWithProofText:(NSString *)proofText {
  KBProveInstructionsView *instructionsView = [[KBProveInstructionsView alloc] init];
  GHWeakSelf gself = self;
  [instructionsView setProofText:proofText serviceName:_serviceName];
  instructionsView.button.targetBlock = ^{ [gself checkProof]; };
  instructionsView.cancelButton.targetBlock = ^{ [gself cancel]; };
  [self.navigation pushView:instructionsView animated:YES];
}

- (void)startProof {
  NSString *serviceUsername = [_inputView.inputField.text gh_strip];

  if ([NSString gh_isBlank:serviceUsername]) {
    // TODO Become first responder
    [KBActivity setError:KBErrorAlert(@"You need to choose a username.") sender:_inputView];
    return;
  }

  // If we're here we're replacing. We don't want to continue.
  /*
  if (_serviceUsername && [_serviceUsername isEqualTo:serviceUsername]) {
    [self continueProof];
    return;
  }
   */
  _serviceUsername = serviceUsername;

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
    [self openInstructionsWithProofText:proofText];
    completion(nil, nil);
  }];

  [KBActivity setProgressEnabled:YES sender:self];
  // TODO: Protocol changed
  /*
  [request startProofWithService:_serviceName username:_serviceUsername force:NO promptPosted:NO completion:^(NSError *error, KBRStartProofResult *startProofResult) {
    [KBActivity setProgressEnabled:NO sender:self];
    if (error) {
      [KBActivity setError:error sender:self];
      return;
    }
    gself.sigId = startProofResult.sigID;
  }];
   */
}

- (void)cancel {
  self.completion(self, NO);
}

- (void)abandon {
  NSAssert(_sigId, @"No sigId");
  NSString *sigId = _sigId;
  GHWeakSelf gself = self;
  [KBActivity setProgressEnabled:YES sender:self];
  KBRRevokeRequest *request = [[KBRRevokeRequest alloc] initWithClient:self.client];
  // TODO: Protocol changed
  /*
  [request revokeSigsWithSigIDs:@[sigId] completion:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    gself.completion(gself, NO);
  }];
   */
}

- (void)continueProof {
  NSAssert(_sigId, @"No sigId");
  NSString *sigId = _sigId;
  KBRProveRequest *request = [[KBRProveRequest alloc] initWithClient:self.client];
  [KBActivity setProgressEnabled:YES sender:self];
  [request checkProofWithSigID:sigId completion:^(NSError *error, KBRCheckProofStatus *checkProofStatus) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;

    if (!checkProofStatus.found) {
      [self openInstructionsWithProofText:checkProofStatus.proofText];
    } else {
      self.completion(self, YES);
    }
  }];
}

- (void)checkProof {
  NSAssert(_sigId, @"No sigId");
  NSString *sigID = _sigId;
  KBRProveRequest *request = [[KBRProveRequest alloc] initWithClient:self.client];
  [KBActivity setProgressEnabled:YES sender:self];
  [request checkProofWithSigID:sigID completion:^(NSError *error, KBRCheckProofStatus *checkProofStatus) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;

    if (checkProofStatus.found) {
      self.completion(self, YES);
    } else {
      [KBActivity setError:KBMakeError(checkProofStatus.status, @"Oops, we couldn't find the proof.") sender:self];
    }
  }];
}

@end


