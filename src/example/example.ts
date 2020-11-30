import {
	loadPackageDefinition,
	credentials,
	Server,
	ServerCredentials,
	sendUnaryData,
	ServerUnaryCall,
} from '@grpc/grpc-js';
import {loadSync} from '@grpc/proto-loader';

const PROTO_PATH = `${__dirname}/../../../protos`;

const packageDefinition = loadSync(
	`Example.proto`,
	{
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true,
		includeDirs: [PROTO_PATH]
	}
);

const loaded = loadPackageDefinition(packageDefinition);
const Example = (loaded.example as any).Example;

export class ExampleClient {
	address: string;
	client: any;

	constructor(address: string) {
		this.address = address;
		this.client = new Example(this.address, credentials.createInsecure());
	}

	async sayHello(name: string) {
		return new Promise(((resolve, reject) => {
			this.client.SayHello({name}, (err: any, response: any) => {
				if (err) {
					reject(err);
				} else {
					resolve(response);
				}
			})
		}));
	}
}

export class ExampleServer {
	address: string;
	server: Server;

	constructor(address: string) {
		this.address = address;
		this.server = new Server();
	}

	run() {
		return new Promise<void>((resolve, reject) => {
			try {
				console.log(`Starting HelloServer`);
				const exampleService =
					this.server.addService(Example.service, {
						SayHello: async (call: ServerUnaryCall<any, any>, callback: sendUnaryData<any>) => {
							console.log(`Saluting`);
							const msg = `Hello ${call.request.name || "world"}`;
							callback(null, {msg});
						},
					});
				this.server.bindAsync(this.address, ServerCredentials.createInsecure(), (err, resp) => {
					if (err) {
						reject(err);
					} else {
						this.server.start();
						resolve();
					}
				});
			} catch (e) {
				reject(e);
			}
		});
	}

	close() {
		return new Promise<void>((resolve, reject) => {
			this.server.tryShutdown((err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
}
