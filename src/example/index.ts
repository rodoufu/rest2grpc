import express from "express";
import {ExampleClient} from "./example";

const fs = require('fs');
const yaml = require("js-yaml");
const util = require('util');
const logger = console;

const readFile = util.promisify(fs.readFile);

(async () => {
	const app: express.Application = express();
	app.use(express.json());
	const exampleClient = new ExampleClient('localhost:50051');

	let fileName = `${__dirname}/../../../protos/Example.yaml`;
	let fileContent = await readFile(fileName);
	let data = yaml.safeLoad(fileContent);
	logger.info(`${JSON.stringify(data)}`);

	for (let rule of data.http.rules) {
		let operationFunc = async (req: any, res: any) => {
			logger.info(JSON.stringify(req.body));
			res.send(await exampleClient.sayHello('Hi'));
		};
		if (rule.get) {
			logger.info(`Registering GET ${rule.get}`)
			app.get(rule.get, operationFunc);
		}
		if (rule.head) {
			logger.info(`Registering HEAD ${rule.head}`)
			app.head(rule.head, operationFunc);
		}
		if (rule.post) {
			logger.info(`Registering POST ${rule.post}`)
			app.post(rule.post, operationFunc);
		}
		if (rule.put) {
			logger.info(`Registering PUT ${rule.put}`)
			app.put(rule.put, operationFunc);
		}
		if (rule.delete) {
			logger.info(`Registering DELETE ${rule.delete}`)
			app.delete(rule.delete, operationFunc);
		}
		if (rule.connect) {
			app.connect(rule.connect, operationFunc);
		}
		if (rule.options) {
			app.options(rule.options, operationFunc);
		}
		if (rule.trace) {
			app.trace(rule.trace, operationFunc);
		}
		if (rule.patch) {
			app.patch(rule.patch, operationFunc);
		}
	}


	app.listen(3000, function () {
		logger.warn(`App is listening on port 3000!`);
	});
})();
