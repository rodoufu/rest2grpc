import express from "express";
import {ExampleClient} from "./example";
const app: express.Application = express();

const exampleClient = new ExampleClient('localhost:50051');

app.get('/list', async (req, res) => {
	res.send(await exampleClient.sayHello('Hi'));
});

app.listen(3000, function () {
	console.log(`App is listening on port 3000!`);
});
