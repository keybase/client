//
//  MPMessagePackServer.m
//  MPMessagePack
//
//  Created by Gabriel on 12/13/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "MPMessagePackServer.h"

#import "MPMessagePackClient.h"

#include <sys/socket.h>
#include <netinet/in.h>
#include <sys/un.h>
#include <unistd.h>

NSString *const MPMessagePackServerErrorDomain = @"MPMessagePackServerErrorDomain";

@interface MPMessagePackServer ()
@property MPMessagePackOptions options;
@property CFSocketRef socket;
@property MPMessagePackClient *client;
@end

@implementation MPMessagePackServer

- (instancetype)initWithOptions:(MPMessagePackOptions)options {
  if ((self = [super init])) {
    _options = options;
  }
  return self;
}

- (void)connectionWithInputStream:(NSInputStream *)inputStream outputStream:(NSOutputStream *)outputStream {
  NSAssert(!_client, @"This server only handles a single client"); // TODO

  MPDebug(@"[Server] Client connected");
  
  _client = [[MPMessagePackClient alloc] initWithName:@"Server" options:_options];
  _client.requestHandler = _requestHandler;
  _client.delegate = self;
  [_client setInputStream:inputStream outputStream:outputStream];
}

- (void)setRequestHandler:(MPRequestHandler)requestHandler {
  _requestHandler = requestHandler;
  _client.requestHandler = requestHandler;
}

static void MPMessagePackServerAcceptCallBack(CFSocketRef socket, CFSocketCallBackType type, CFDataRef address, const void *data, void *info) {
  MPMessagePackServer *server = (__bridge MPMessagePackServer *)info;
  //MPDebug(@"Accept callback type: %d", (int)type);
  if (kCFSocketAcceptCallBack == type) {
    CFSocketNativeHandle nativeSocketHandle = *(CFSocketNativeHandle *)data;
    CFReadStreamRef readStream = NULL;
    CFWriteStreamRef writeStream = NULL;
    CFStreamCreatePairWithSocket(kCFAllocatorDefault, nativeSocketHandle, &readStream, &writeStream);
    if (readStream && writeStream) {
      CFReadStreamSetProperty(readStream, kCFStreamPropertyShouldCloseNativeSocket, kCFBooleanTrue);
      CFWriteStreamSetProperty(writeStream, kCFStreamPropertyShouldCloseNativeSocket, kCFBooleanTrue);
      [server connectionWithInputStream:(__bridge NSInputStream *)readStream outputStream:(__bridge NSOutputStream *)writeStream];
    } else {
      close(nativeSocketHandle);
    }
    if (readStream) {
      CFRelease(readStream);
      readStream = nil;
    }
    if (writeStream) {
      CFRelease(writeStream);
      writeStream = nil;
    }
  }
}

- (BOOL)openWithPort:(uint16_t)port error:(NSError **)error {
  struct sockaddr_in addr4;
  memset(&addr4, 0, sizeof(addr4));
  addr4.sin_len = sizeof(addr4);
  addr4.sin_family = AF_INET;
  addr4.sin_port = htons(port);
  addr4.sin_addr.s_addr = htonl(INADDR_ANY);
  NSData *address = [NSData dataWithBytes:&addr4 length:sizeof(addr4)];
  
  CFSocketContext socketContext = {0, (__bridge void *)(self), NULL, NULL, NULL};
  _socket = CFSocketCreate(kCFAllocatorDefault, PF_INET, SOCK_STREAM, IPPROTO_TCP, kCFSocketAcceptCallBack, (CFSocketCallBack)&MPMessagePackServerAcceptCallBack, &socketContext);
  
  if (!_socket) {
    if (_socket) CFRelease(_socket);
    _socket = NULL;
    if (error) {
       *error = MPMakeError(errno, @"Couldn't create socket");
    }
    return NO;
  }
  
  int yes = 1;
  setsockopt(CFSocketGetNative(_socket), SOL_SOCKET, SO_REUSEADDR, (void *)&yes, sizeof(yes));
  // TODO: tcp_no_delay?
  
  if (kCFSocketSuccess != CFSocketSetAddress(_socket, (CFDataRef)address)) {
    if (_socket) {
      CFRelease(_socket);
      _socket = NULL;
    }
    if (error) {
       *error = MPMakeError(501, @"Couldn't bind socket");
    }
    return NO;
  }
  
  CFRunLoopSourceRef source4 = CFSocketCreateRunLoopSource(kCFAllocatorDefault, _socket, 0);
  CFRunLoopAddSource(CFRunLoopGetCurrent(), source4, kCFRunLoopCommonModes);
  CFRelease(source4);
  
  MPDebug(@"Created socket");
  return YES;
}

- (void)close {
  if (_socket) {
    CFSocketInvalidate(_socket);
    _socket = NULL;
  }
}

#pragma mark -

- (void)client:(MPMessagePackClient *)client didError:(NSError *)error fatal:(BOOL)fatal {
  MPErr(@"Client error: %@", error);
  if (fatal) {
    [_client close];
  }
}

- (void)client:(MPMessagePackClient *)client didReceiveNotificationWithMethod:(NSString *)method params:(id)params {
  if (self.notificationHandler) self.notificationHandler(nil, method, params, nil);
}

- (void)client:(MPMessagePackClient *)client didChangeStatus:(MPMessagePackClientStatus)status {
  
}

#pragma mark -

/*
- (BOOL)openWithSocket:(NSString *)socketName error:(NSError **)error {
  struct sockaddr_un sun;
  sun.sun_family = AF_UNIX;
  strcpy(&sun.sun_path[0], [socketName UTF8String]);
  size_t len = SUN_LEN(&sun);
  sun.sun_len = len;
  NSData *address = [NSData dataWithBytes:&sun length:SUN_LEN(&sun)];
  
  if ([NSFileManager.defaultManager fileExistsAtPath:socketName]) {
    unlink([socketName UTF8String]); // fileSystemRepresentation?
    [NSFileManager.defaultManager removeItemAtPath:socketName error:error];
    if (*error) {
      return NO;
    }
  }
  
  CFSocketNativeHandle socketHandle = socket(AF_UNIX, SOCK_STREAM, 0);
  CFSocketContext context = {0, (__bridge void *)self, nil, nil, nil};
  _socket = CFSocketCreateWithNative(nil, socketHandle, kCFSocketAcceptCallBack, MPMessagePackSocketCallBack, &context);
  
  if (!_socket) {
    *error = MPMakeError(-3, @"Unable to create socket %@", socketName);
    return NO;
  }
  
  int opt = 1;
  setsockopt(socketHandle, SOL_SOCKET, SO_REUSEADDR, (void *)&opt, sizeof(opt));
  setsockopt(socketHandle, SOL_SOCKET, SO_NOSIGPIPE, (void *)&opt, sizeof(opt));
  
  if (CFSocketSetAddress(_socket, (__bridge CFDataRef)address) != kCFSocketSuccess) {
    *error = MPMakeError(-3, @"Unable to set socket address %@", socketName);
    return NO;
  }
  
  CFRunLoopSourceRef sourceRef = CFSocketCreateRunLoopSource(kCFAllocatorDefault, _socket, 0);
  CFRunLoopAddSource(CFRunLoopGetCurrent(), sourceRef, kCFRunLoopCommonModes);
  CFRelease(sourceRef);
  
  return YES;
  
  //  int serverSocket = socket(AF_UNIX, SOCK_STREAM, 0);
  //  if (bind(serverSocket, (struct sockaddr *)&sun, sun.sun_len) != 0) {
  //    *error = MPMakeError(-2, @"Unable to bind to %@", socketName);
  //    return NO;
  //  }
  //  if (listen(serverSocket, 1) != 0) { // In practice you'd specify more than 1
  //    *error = MPMakeError(-3, @"Unable to listen to %@", socketName);
  //    return NO;
  //  };
  //
  //  dispatch_queue_t queue = dispatch_queue_create("MPMessagePackServer", NULL);
  //
  //  dispatch_async(queue, ^{
  //    CFSocketNativeHandle sock = accept(serverSocket, NULL, NULL);
  //    CFReadStreamRef readStream = NULL;
  //    CFWriteStreamRef writeStream = NULL;
  //    CFStreamCreatePairWithSocket (kCFAllocatorDefault, sock, &readStream, &writeStream);
  //    //dispatch_async(dispatch_get_main_queue(), ^{
  //    [self connectionWithInputStream:(__bridge NSInputStream *)readStream outputStream:(__bridge NSOutputStream *)writeStream];
  //    //});
  //  });
  
  return YES;
}

static void MPMessagePackSocketCallBack(CFSocketRef socket, CFSocketCallBackType type, CFDataRef address, const void *data, void *info) {
  MPMessagePackServer *server = (__bridge MPMessagePackServer *)info;
  MPDebug(@"Socket callback: %d", (int)type);
  if (kCFSocketAcceptCallBack == type) {
    [server connectStreams];
  }
}

- (void)connectStreams {
  CFSocketNativeHandle sock = CFSocketGetNative(_socket);
  CFSocketSetSocketFlags(_socket, 0);
  CFSocketInvalidate(_socket);
  CFRelease(_socket);
  
  CFReadStreamRef readStream = NULL;
  CFWriteStreamRef writeStream = NULL;
  CFStreamCreatePairWithSocket(kCFAllocatorDefault, sock, &readStream, &writeStream);
  if (readStream && writeStream) {
    CFReadStreamSetProperty(readStream, kCFStreamPropertyShouldCloseNativeSocket, kCFBooleanTrue);
    CFWriteStreamSetProperty(writeStream, kCFStreamPropertyShouldCloseNativeSocket, kCFBooleanTrue);
    [self connectionWithInputStream:(__bridge NSInputStream *)readStream outputStream:(__bridge NSOutputStream *)writeStream];
  } else {
    MPDebug(@"Unable to create streams");
    close(sock);
  }
  if (readStream) {
    CFRelease(readStream);
    readStream = nil;
  }
  if (writeStream) {
    CFRelease(writeStream);
    writeStream = nil;
  }
}
 */

@end
