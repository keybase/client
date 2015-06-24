//
//  KBProveView.m
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveView.h"

#import "KBProveType.h"
#import "KBProveRooterInstructions.h"
#import "KBDefines.h"

@interface KBProveView ()
@property (nonatomic) NSString *serviceName;
@property (copy) KBProveCompletion completion;

@property KBProveInputView *inputView;
@property YOView<KBProveInstructionsView> *instructionsView;

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
  [self addSubview:_inputView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout centerWithSize:CGSizeMake(size.width, 0) frame:CGRectMake(0, 0, size.width, size.height) view:yself.inputView];
    [layout setSize:size view:yself.instructionsView options:0];
    return size;
  }];
}

+ (void)connectWithServiceName:(NSString *)serviceName proofResult:(KBProofResult *)proofResult client:(KBRPClient *)client window:(KBWindow *)window completion:(KBProveCompletion)completion {
  KBProveView *proveView = [[KBProveView alloc] init];
  proveView.client = client;
  [proveView setServiceName:serviceName proofResult:proofResult];

  NSWindow *proveWindow = [window addModalWindowForView:proveView rect:CGRectMake(0, 0, 620, 420)];

  KBProveCompletion close = ^(BOOL success) {
    [proveWindow close];
    completion(success);
  };
  proveView.completion = close;
  proveView.inputView.cancelButton.targetBlock = ^{ close(NO); };
}

- (YOView<KBProveInstructionsView> *)instructionsViewForServiceName:(NSString *)serviceName {
  if ([serviceName isEqualTo:@"rooter"]) {
    return [[KBProveRooterInstructions alloc] init];
  } else {
    return [[KBProveInstructionsView alloc] init];
  }
}

- (void)setServiceName:(NSString *)serviceName proofResult:(KBProofResult *)proofResult {
  _serviceName = serviceName;
  _serviceUsername = proofResult.proof.value;
  _sigId = proofResult.proof.sigID;

  [_inputView setServiceName:serviceName];

  if (_serviceUsername) {
    _inputView.inputField.text = _serviceUsername;
  }

  [self setNeedsLayout];

//  if (_sigId) {
//    [self continueProof];
//  } else {
  [self.window makeFirstResponder:_inputView.inputField];
//  }
}

- (void)openInstructionsWithProofText:(NSString *)proofText {
  [_instructionsView removeFromSuperview];
  _instructionsView = [self instructionsViewForServiceName:_serviceName];
  GHWeakSelf gself = self;
  [_instructionsView setProofText:proofText serviceName:_serviceName];
  _instructionsView.button.targetBlock = ^{ [gself checkProof]; };
  _instructionsView.cancelButton.targetBlock = ^{ [gself cancel]; };
  [self addSubview:_instructionsView];

  [self setNeedsLayout];

  // TODO Animate change
  self.inputView.hidden = YES;
  self.instructionsView.hidden = NO;
}

- (void)startProof {
  NSString *serviceUsername = [_inputView.inputField.text gh_strip];

  if ([NSString gh_isBlank:serviceUsername]) {
    // TODO Become first responder
    [KBActivity setError:KBErrorAlert(@"You need to choose a username.") sender:_inputView];
    return;
  }

  if (_serviceUsername && [_serviceUsername isEqualTo:serviceUsername]) {
    [self continueProof];
    return;
  }
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
  [request startProofWithSessionID:request.sessionId service:_serviceName username:_serviceUsername force:NO promptPosted:NO completion:^(NSError *error, KBRStartProofResult *startProofResult) {
    [KBActivity setProgressEnabled:NO sender:self];
    if (error) {
      [KBActivity setError:error sender:self];
      return;
    }
    gself.sigId = startProofResult.sigID;
  }];
}

- (void)cancel {
  NSString *sigID = _sigId;
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

- (void)continueProof {
  NSString *sigID = _sigId;
  KBRProveRequest *request = [[KBRProveRequest alloc] initWithClient:self.client];
  [KBActivity setProgressEnabled:YES sender:self];
  [request checkProofWithSessionID:request.sessionId sigID:sigID completion:^(NSError *error, KBRCheckProofStatus *checkProofStatus) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;

    if (!checkProofStatus.found) {
      [self openInstructionsWithProofText:checkProofStatus.proofText];
    } else {
      self.completion(YES);
    }
  }];
}

- (void)checkProof {
  NSString *sigID = _sigId;
  KBRProveRequest *request = [[KBRProveRequest alloc] initWithClient:self.client];
  [KBActivity setProgressEnabled:YES sender:self];
  [request checkProofWithSessionID:request.sessionId sigID:sigID completion:^(NSError *error, KBRCheckProofStatus *checkProofStatus) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;

    if (checkProofStatus.found) {
      self.completion(YES);
    } else {
      [KBActivity setError:KBMakeError(checkProofStatus.status, @"Oops, we couldn't find the proof.") sender:self];
    }
  }];
}

@end


