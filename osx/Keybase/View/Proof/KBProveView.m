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

@interface KBProveView ()
@property NSString *serviceUsername;
@property NSNumber *sessionId;
@property (nonatomic) KBProveType proveType;
@property KBProofResult *proofResult;
@property (copy) KBProveCompletion completion;
@end

@implementation KBProveView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  GHWeakSelf gself = self;

  _inputView = [[KBProveInputView alloc] init];
  _inputView.button.targetBlock = ^{ [gself prove]; };
  [self addSubview:_inputView];

  _instructionsView = [[KBProveInstructionsView alloc] init];
  _instructionsView.button.targetBlock = ^{ [gself check]; };
  _instructionsView.cancelButton.targetBlock = ^{ [gself cancel]; };
  _instructionsView.deleteButton.targetBlock = ^{ [gself delete]; };
  _instructionsView.hidden = YES;
  [self addSubview:_instructionsView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout centerWithSize:CGSizeMake(size.width, 0) frame:CGRectMake(0, 0, size.width, size.height) view:yself.inputView];
    [layout setSize:size view:yself.instructionsView options:0];
    return size;
  }];
}

+ (void)connectWithProveType:(KBProveType)proveType proofResult:(KBProofResult *)proofResult client:(KBRPClient *)client sender:(NSView *)sender completion:(KBProveCompletion)completion {
  KBProveView *proveView = [[KBProveView alloc] init];
  proveView.client = client;
  [proveView setProveType:proveType proofResult:proofResult];

  NSWindow *window = [sender.window kb_addChildWindowForView:proveView rect:CGRectMake(0, 0, 620, 420) position:KBWindowPositionCenter title:@"Keybase" fixed:YES makeKey:YES];

  KBProveCompletion close = ^(KBProofResult *proofResult) {
    [window close];
    completion(proofResult);
  };
  proveView.completion = close;
  proveView.inputView.cancelButton.targetBlock = ^{ close(nil); };
}

- (void)setProveType:(KBProveType)proveType proofResult:(KBProofResult *)proofResult {
  _proveType = proveType;
  _proofResult = proofResult;
  [_inputView setProveType:proveType];

  if (_proofResult) {
    [self setInstructions:[[KBRText alloc] init] proofText:@""];
  } else {
    [self.window makeFirstResponder:_inputView.inputField];
  }
}

- (void)setInstructions:(KBRText *)instructions proofText:(NSString *)proofText {
  [_instructionsView setInstructions:instructions proofText:proofText proveType:_proveType];
  [_instructionsView layoutView];

  // TODO Animate change
  self.inputView.hidden = YES;
  self.instructionsView.hidden = NO;
}

- (void)prove {
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

    [KBActivity setProgressEnabled:NO sender:self];
    [self setInstructions:instructions proofText:proof];
    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.proveUi.displayRecheckWarning" sessionId:prove.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRDisplayRecheckWarningRequestParams *requestParams = [[KBRDisplayRecheckWarningRequestParams alloc] initWithParams:params];

    DDLogDebug(@"Recheck warning: %@", requestParams.text.data);
    completion(nil, nil);
  }];

  [KBActivity setProgressEnabled:YES sender:self];
  _sessionId = @(prove.sessionId);
  [prove startProofWithSessionID:prove.sessionId service:service username:_serviceUsername force:NO completion:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if (error) {
      [AppDelegate setError:error sender:gself.inputView];
      // Retry?
      return;
    }
  }];
}

- (void)delete {
  NSString *sigId = _proofResult.proof.sigID;
  if (!sigId) {
    [KBActivity setError:KBMakeError(-1, @"Nothing to remove") sender:self];
    return;
  }

  GHWeakSelf gself = self;
  [KBActivity setProgressEnabled:YES sender:self];
  KBRRevokeRequest *request = [[KBRRevokeRequest alloc] initWithClient:self.client];
  [request revokeSigsWithSessionID:request.sessionId ids:@[sigId] seqnos:@[] completion:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    gself.sessionId = nil;
    gself.completion(NO);
  }];
}

- (void)cancel {
  if (!_sessionId) {
    self.completion(NO);
    return;
  }

  GHWeakSelf gself = self;
  [KBActivity setProgressEnabled:YES sender:self];
  KBRProveRequest *request = [[KBRProveRequest alloc] initWithClient:self.client];
  [request cancelProofWithSessionID:[_sessionId integerValue] completion:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    if ([KBActivity setError:error sender:self]) return;
    gself.sessionId = nil;
    gself.completion(NO);
  }];
}

- (void)check {
  NSData *sigID = KBHexData(_proofResult.proof.sigID);
  sigID = [sigID subdataWithRange:NSMakeRange(0, 32)];
  KBProofResult *proofResult = _proofResult;
  KBRProveRequest *request = [[KBRProveRequest alloc] initWithClient:self.client];
  [KBActivity setProgressEnabled:YES sender:self];
  [request checkProofWithSessionID:request.sessionId sigID:(KBRSIGID *)sigID completion:^(NSError *error, KBRCheckProofStatus *checkProofStatus) {
    [KBActivity setProgressEnabled:NO sender:self];

    DDLogDebug(@"Remote proof: %@", checkProofStatus);

    if (checkProofStatus.found) {
      self.completion(proofResult);
    }
  }];
}

@end


