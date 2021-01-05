# rest2grpc

<p align="center">
  <a href="https://travis-ci.com/github/rodoufu/rest2grpc">
    <img src="https://api.travis-ci.com/rodoufu/rest2grpc.svg?branch=main" alt="Current TravisCI build status.">
  </a>
  <a href="https://github.com/rodoufu/rest2grpc/releases">
    <img src="https://badge.fury.io/gh/rodoufu%2Frest2grpc.svg" alt="Current version.">
  </a>
  <!--
  <a href='https://coveralls.io/github/rodoufu/rest2grpc'>
    <img src='https://coveralls.io/repos/github/rodoufu/rest2grpc/badge.svg' alt='Coverage Status' />
  </a>
  -->
  <a href="https://github.com/rodoufu/rest2grpc">
      <img src="https://tokei.rs/b1/github/rodoufu/rest2grpc?category=lines" alt="Current total lines.">
    </a>
  <a href="https://github.com/rodoufu/rest2grpc/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License.">
  </a>
</p>

Available at https://www.npmjs.com/package/rest2grpc

## Example

Let's say we have a simple gRPC backend service that we want to expose as a REST endpoint,
something like this protos file (`Example.proto`):
```proto
syntax = "proto3";

package example;

service Example {
	rpc SayHello (SayHelloRequest) returns (SayHelloResponse) {}
}

message SayHelloRequest {
	string name = 1;
}

message SayHelloResponse {
	string msg = 1;
}
```

We can use the following configuration (`Example.yaml`) to do so:
```yaml
http:
  rules:
    - selector: example.Example.SayHello
      get: /sayHelloGet
      post: /sayHelloPost
```

That tells rest2grpc to create 2 endpoints:
- `/sayHelloGet` answering to GET requests.
- `/sayHelloPost` answering to POST requests.

Both requests are translated into gRPC and sent to the namespace `example`, service `Example`, 
and call the method `SayHello`.

Now to call everything you only need to:
```ts
import {Rest2gRPCServer} from 'rest2grpc';
(async () => {
	const address = 'localhost:50051';

	let configFile = `${__dirname}/Example.yaml`;
	const restServer = new Rest2gRPCServer(console);
	const protoPath = [`${__dirname}/protos`];
	const protoFile = "Example.proto";
	await restServer.register(configFile, protoPath, protoFile, address);

	restServer.start(3000);
})();
```

## References

- https://github.com/grpc-ecosystem/grpc-gateway
