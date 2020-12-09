import express from "express";
import {
	loadPackageDefinition,
	credentials,
	ChannelCredentials,
} from '@grpc/grpc-js';
import {loadSync} from '@grpc/proto-loader';

const fs = require('fs');
const yaml = require("js-yaml");
const util = require('util');

const readFile = util.promisify(fs.readFile);

export class Rest2gRPCServer {
	app: express.Application;
	logger: any;
	clients: { [id: string]: any };

	constructor(logger?: any) {
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

	async register(
		configFile: string, protoPath: string[], protoFile: string, address: string,
		channelCredentials?: ChannelCredentials
	) {
		if (!channelCredentials) {
			channelCredentials = credentials.createInsecure();
		}
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
			const TheClass = theNamespace[className];
			this.clients[rule.selector] = new TheClass(address, channelCredentials);

			let operationFunc = async (req: any, res: any) => {
				let gRpcResp = new Promise(((resolve, reject) => {
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
				this.logger.info(`Registering GET ${rule.get} for ${rule.selector}`);
				this.app.get(rule.get, operationFunc);
			}
			if (rule.head) {
				this.logger.info(`Registering HEAD ${rule.head} for ${rule.selector}`);
				this.app.head(rule.head, operationFunc);
			}
			if (rule.post) {
				this.logger.info(`Registering POST ${rule.post} for ${rule.selector}`);
				this.app.post(rule.post, operationFunc);
			}
			if (rule.put) {
				this.logger.info(`Registering PUT ${rule.put} for ${rule.selector}`);
				this.app.put(rule.put, operationFunc);
			}
			if (rule.delete) {
				this.logger.info(`Registering DELETE ${rule.delete} for ${rule.selector}`);
				this.app.delete(rule.delete, operationFunc);
			}
			if (rule.connect) {
				this.logger.info(`Registering CONNECT ${rule.connect} for ${rule.selector}`);
				this.app.connect(rule.connect, operationFunc);
			}
			if (rule.options) {
				this.logger.info(`Registering OPTIONS ${rule.options} for ${rule.selector}`);
				this.app.options(rule.options, operationFunc);
			}
			if (rule.trace) {
				this.logger.info(`Registering TRACE ${rule.trace} for ${rule.selector}`);
				this.app.trace(rule.trace, operationFunc);
			}
			if (rule.patch) {
				this.logger.info(`Registering PATCH ${rule.patch} for ${rule.selector}`);
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
	const restServer = new Rest2gRPCServer(console);
	const protoPath = [`${__dirname}/../../../protos`];
	const protoFile = "Example.proto";
	await restServer.register(configFile, protoPath, protoFile, address);

	restServer.start(3000);
})();
