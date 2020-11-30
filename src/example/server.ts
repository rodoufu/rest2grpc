import {ExampleClient, ExampleServer} from "./example";

(async () => {
	const exampleServer = new ExampleServer('0.0.0.0:50051');
	await exampleServer.run();
})();
