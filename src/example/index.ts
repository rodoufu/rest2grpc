import {Rest2gRPCServer} from '../rest2grpcServer';

(async () => {
	const address = 'localhost:50051';

	let configFile = `${__dirname}/../../../protos/Example.yaml`;
	const restServer = new Rest2gRPCServer(console);
	const protoPath = [`${__dirname}/../../../protos`];
	const protoFile = "Example.proto";
	await restServer.register(configFile, protoPath, protoFile, address);

	restServer.start(3000);
})();
