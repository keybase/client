#pragma once
#include <cstddef>
#include <cstdint>
#include <jsi/jsi.h>
#include <memory>
#include <msgpack/v2/unpack_decl.hpp>

facebook::jsi::Value RpcOnGo(facebook::jsi::Runtime &runtime,
                             const facebook::jsi::Value &thisValue,
                             const facebook::jsi::Value *arguments,
                             size_t count,
                             void (*callback)(void *ptr, size_t size));

typedef std::shared_ptr<std::vector<msgpack::object_handle>> ShareValues;
ShareValues PrepRpcOnJS(facebook::jsi::Runtime &runtime, uint8_t *data, int size);
void RpcOnJS(facebook::jsi::Runtime &runtime, ShareValues values, void (*err_callback)(const std::string & err));
void Teardown();
void Tearup();
