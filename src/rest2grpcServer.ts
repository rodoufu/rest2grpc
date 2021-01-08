import express, {Request, Response} from "express";
import {
	loadPackageDefinition,
	credentials,
	ChannelCredentials,
	GrpcObject,
} from '@grpc/grpc-js';
import {load} from '@grpc/proto-loader';
import {ErrorHandler} from "./errorHandler";
import {Interceptor} from "./interceptor";
import http from "http";

const fs = require('fs');
const yaml = require("js-yaml");
const util = require('util');

const readFile = util.promisify(fs.readFile);

/**
 * Possible error sources for the ErrorHandler.
 */
export enum ErrorSource {
	InterceptorPreHandle,
	InterceptorPostHandle,
	InterceptorAfterCompletion,
}

/**
 * REST server who translates the requests into gRPC.
 */
export class Rest2gRPCServer {
	private readonly app: express.Application;
	private httpServer?: http.Server;
	private readonly logger: any;
	private readonly clients: { [id: string]: any };
	private readonly errorHandler: ErrorHandler;
	private readonly interceptors: Interceptor[];

	constructor(logger?: any, errorHandler?: ErrorHandler) {
		this.app = express();
		this.app.use(express.json());
		this.logger = logger;
		this.interceptors = [];
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
		let theLogger = this.logger;
		this.clients = {};
		if (!errorHandler) {
			this.errorHandler = new class implements ErrorHandler {
				handle(source: ErrorSource, error: any): boolean {
					theLogger.error(`${source} generated the error ${JSON.stringify(error)}`);
					return false;
				}
			};
		} else {
			this.errorHandler = errorHandler;
		}
	}

	/**
	 * Extracts the namespace, class name, and method name from the selector.
	 * @param selector The configuration selector.
	 */
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

	/**
	 * Loads the package from the proto file.
	 * @param protoPath Array with the path to look for the proto imports.
	 * @param protoFile Proto file to be loaded.
	 */
	async loadPackage(protoPath: string[], protoFile: string): Promise<GrpcObject> {
		const packageDefinition = await load(
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

		return loadPackageDefinition(packageDefinition);
	}

	/**
	 * Reads the YAMl configuration file.
	 * @param configFile File location.
	 */
	async readConfig(configFile: string): Promise<any> {
		let fileContent = await readFile(configFile);
		const configData = yaml.safeLoad(fileContent);
		if (!configData.http || !configData.http.rules) {
			throw `Unexpected content for the config file ${configFile}`;
		}
		return configData;
	}

	/**
	 * Registers a new endpoint related to the configuration.
	 * @param configFile The configuration file.
	 * @param protoPath Array with the path to look for the proto imports.
	 * @param protoFile Proto file to be loaded.
	 * @param address Address to the gRPC endpoint to be called.
	 * @param channelCredentials Credentials to be used.
	 */
	async register(
		configFile: string, protoPath: string[], protoFile: string, address: string,
		channelCredentials?: ChannelCredentials
	) {
		if (!channelCredentials) {
			channelCredentials = credentials.createInsecure();
		}

		const loaded = await this.loadPackage(protoPath, protoFile);
		const configData = await this.readConfig(configFile);

		for (let rule of configData.http.rules) {
			if (!rule.selector) {
				throw `The selector for the rule is mandatory`;
			}
			if (this.clients[rule.selector]) {
				throw `The selector ${rule.selector} has already been registered`;
			}

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

			this.registerHttpMethods(rule, methodName);
		}
	}

	httpMethodCallback(rule: any, methodName: string): (req: Request, res: Response) => Promise<void> {
		return async (req: Request, res: Response) => {
			let gRpcReq = new Promise(((resolve, reject) => {
				const client = this.clients[rule.selector];
				client[methodName](req.body, (err: any, result: any) => {
					if (err) {
						reject(err);
					} else {
						resolve(result);
					}
				});
			}));

			for (const interceptor of this.interceptors) {
				try {
					if (!interceptor.preHandle(req, res)) {
						this.logger.debug(`Ignoring request ${JSON.stringify(req)}`);
						return;
					}
				} catch (e) {
					if (!this.errorHandler.handle(ErrorSource.InterceptorPreHandle, e)) {
						throw e;
					}
				}
			}
			const gRrpcResp = await gRpcReq;
			for (const interceptor of this.interceptors) {
				try {
					interceptor.postHandle(req, res, gRrpcResp);
				} catch (e) {
					if (!this.errorHandler.handle(ErrorSource.InterceptorPostHandle, e)) {
						throw e;
					}
				}
			}
			res.send(gRrpcResp);
			for (const interceptor of this.interceptors) {
				try {
					interceptor.afterCompletion(req, res, gRrpcResp);
				} catch (e) {
					if (!this.errorHandler.handle(ErrorSource.InterceptorAfterCompletion, e)) {
						throw e;
					}
				}
			}
		};
	}

	registerHttpMethods(rule: any, methodName: string) {
		if (rule.get) {
			this.logger.info(`Registering GET ${rule.get} for ${rule.selector}`);
			this.app.get(rule.get, this.httpMethodCallback(rule, methodName));
		}
		if (rule.head) {
			this.logger.info(`Registering HEAD ${rule.head} for ${rule.selector}`);
			this.app.head(rule.head, this.httpMethodCallback(rule, methodName));
		}
		if (rule.post) {
			this.logger.info(`Registering POST ${rule.post} for ${rule.selector}`);
			this.app.post(rule.post, this.httpMethodCallback(rule, methodName));
		}
		if (rule.put) {
			this.logger.info(`Registering PUT ${rule.put} for ${rule.selector}`);
			this.app.put(rule.put, this.httpMethodCallback(rule, methodName));
		}
		if (rule.delete) {
			this.logger.info(`Registering DELETE ${rule.delete} for ${rule.selector}`);
			this.app.delete(rule.delete, this.httpMethodCallback(rule, methodName));
		}
		if (rule.connect) {
			this.logger.info(`Registering CONNECT ${rule.connect} for ${rule.selector}`);
			this.app.connect(rule.connect, this.httpMethodCallback(rule, methodName));
		}
		if (rule.options) {
			this.logger.info(`Registering OPTIONS ${rule.options} for ${rule.selector}`);
			this.app.options(rule.options, this.httpMethodCallback(rule, methodName));
		}
		if (rule.trace) {
			this.logger.info(`Registering TRACE ${rule.trace} for ${rule.selector}`);
			this.app.trace(rule.trace, this.httpMethodCallback(rule, methodName));
		}
		if (rule.patch) {
			this.logger.info(`Registering PATCH ${rule.patch} for ${rule.selector}`);
			this.app.patch(rule.patch, this.httpMethodCallback(rule, methodName));
		}
	}

	/**
	 * Adds an interceptor to the requests.
	 * @param interceptor Interceptor to be included.
	 */
	addInterceptor(interceptor: Interceptor): void {
		this.interceptors.push(interceptor);
	}

	/**
	 * Starts the Express server.
	 * @param port Port number to listen.
	 */
	start(port: number): void {
		let localLogger = this.logger;
		this.httpServer = this.app.listen(port, function () {
			localLogger.warn(`App is listening on port ${port}!`);
		});
	}

	close(): void {
		if (this.httpServer) {
			this.logger.warn(`Close operation initiated`);
			this.httpServer.close(() => {
				this.logger.warn(`Close operation finished`);
			});
		}
	}
}

export {
	ChannelCredentials,
	GrpcObject,
	Request,
	Response,
};
