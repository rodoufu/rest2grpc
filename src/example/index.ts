import express from "express";
import {
	loadPackageDefinition,
	credentials,
	Server,
	ServerCredentials,
	sendUnaryData,
	ServerUnaryCall,
} from '@grpc/grpc-js';
import {loadSync} from '@grpc/proto-loader';
import {ExampleClient} from "./example";

const fs = require('fs');
const yaml = require("js-yaml");
const util = require('util');

const readFile = util.promisify(fs.readFile);

export class RestServer {
	app: express.Application;
	logger: any;
	clients: { [id: string]: any };

	constructor(logger: any) {
		this.app = express();
		this.app.use(express.json());
		this.logger = logger;
		if (!logger) {
			this.logger = {
				info: (...args: any[]) => {
				},
				debug: (...args: any[]) => {
				},
				warn: (...args: any[]) => {
				},
				error: (...args: any[]) => {
				},
				trace: (...args: any[]) => {
				},
			}
		}
		this.clients = {};
	}

	extractNamespaceClassMethod(selector: string): [string, string, string] {
		let namespace: string;
		let className: string;
		let methodName: string;
		let splited = selector.split('.');
		if (splited.length < 2) {
			throw `Invalid selector: ${selector}`;
		}
		methodName = <string>splited.pop();
		className = <string>splited.pop();
		if (splited.length == 0) {
			namespace = "";
		} else {
			namespace = splited.join('.');
		}
		return [namespace, className, methodName];
	}

	async register(configFile: string, protoPath: string[], protoFile: string, address: string) {
		const packageDefinition = loadSync(
			protoFile,
			{
				keepCase: true,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
				includeDirs: protoPath,
			}
		);

		const loaded = loadPackageDefinition(packageDefinition);

		let fileContent = await readFile(configFile);
		let configData = yaml.safeLoad(fileContent);

		if (!configData.http || !configData.http.rules) {
			throw `Unexpected content for the config file ${configFile}`;
		}
		for (let rule of configData.http.rules) {
			let namespaceClassMethod = this.extractNamespaceClassMethod(rule.selector);
			const namespace = namespaceClassMethod[0];
			const className = namespaceClassMethod[1];
			const methodName = namespaceClassMethod[2];

			let theNamespace: any = loaded;
			if (namespace.length) {
				theNamespace = theNamespace[namespace];
			}
			// const Example = (loaded.example as any).Example; // FIXME
			const TheClass = theNamespace[className];
			// this.clients[rule.selector] = new Example(address, credentials.createInsecure());
			this.clients[rule.selector] = new TheClass(address, credentials.createInsecure());

			let operationFunc = async (req: any, res: any) => {
				this.logger.info(JSON.stringify(req.body));
				// res.send(await exampleClient.sayHello('Hi'));
				let gRpcResp = new Promise(((resolve, reject) => {
					// this.clients[rule.selector].SayHello(req.body, (err: any, response: any) => {
					// 	if (err) {
					// 		reject(err);
					// 	} else {
					// 		resolve(response);
					// 	}
					// });
					const client = this.clients[rule.selector];
					client[methodName](req.body, (err: any, response: any) => {
						if (err) {
							reject(err);
						} else {
							resolve(response);
						}
					});
				}));
				res.send(await gRpcResp);
			};
			if (rule.get) {
				this.logger.info(`Registering GET ${rule.get}`);
				this.app.get(rule.get, operationFunc);
			}
			if (rule.head) {
				this.logger.info(`Registering HEAD ${rule.head}`);
				this.app.head(rule.head, operationFunc);
			}
			if (rule.post) {
				this.logger.info(`Registering POST ${rule.post}`);
				this.app.post(rule.post, operationFunc);
			}
			if (rule.put) {
				this.logger.info(`Registering PUT ${rule.put}`);
				this.app.put(rule.put, operationFunc);
			}
			if (rule.delete) {
				this.logger.info(`Registering DELETE ${rule.delete}`);
				this.app.delete(rule.delete, operationFunc);
			}
			if (rule.connect) {
				this.logger.info(`Registering CONNECT ${rule.connect}`);
				this.app.connect(rule.connect, operationFunc);
			}
			if (rule.options) {
				this.logger.info(`Registering OPTIONS ${rule.options}`);
				this.app.options(rule.options, operationFunc);
			}
			if (rule.trace) {
				this.logger.info(`Registering TRACE ${rule.trace}`);
				this.app.trace(rule.trace, operationFunc);
			}
			if (rule.patch) {
				this.logger.info(`Registering PATCH ${rule.patch}`);
				this.app.patch(rule.patch, operationFunc);
			}
		}
	}

	start(port: number) {
		let localLogger = this.logger;
		this.app.listen(port, function () {
			localLogger.warn(`App is listening on port ${port}!`);
		});
	}
}

(async () => {
	const address = 'localhost:50051';

	let configFile = `${__dirname}/../../../protos/Example.yaml`;
	const restServer = new RestServer(console);
	const protoPath = [`${__dirname}/../../../protos`];
	const protoFile = "Example.proto";
	await restServer.register(configFile, protoPath, protoFile, address);

	restServer.start(3000);
})();
