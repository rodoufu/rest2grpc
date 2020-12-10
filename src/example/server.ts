import {ExampleClient, ExampleServer} from './example';

(async () => {
	const address = '0.0.0.0:50051';
	const exampleServer = new ExampleServer(address);
	console.warn(`Listening at ${address}`);
	await exampleServer.run();
})();
