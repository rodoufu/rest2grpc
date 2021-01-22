import {Rest2gRPCServer} from "../src";

test('Fixing endpoints', () => {
	const restServer = new Rest2gRPCServer();
	expect(restServer.fixEndpoint('/v1.1/wallets/{asset}')).toBe('/v1.1/wallets/:asset');
	expect(restServer.fixEndpoint('/v1.1/{wallets}/{asset}')).toBe('/v1.1/:wallets/:asset');
	expect(restServer.fixEndpoint('/v1.1/wallets/asset')).toBe('/v1.1/wallets/asset');

	expect(restServer.fixEndpoint('/v1.1/:wallets/asset')).toBe('/v1.1/:wallets/asset');
});
