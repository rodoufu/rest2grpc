import {Request, Response} from "express-serve-static-core";

/**
 * Request interceptor.
 */
export interface Interceptor {
	/**
	 * This is used to perform operations before sending the request to the controller.
	 * This method should return true to return the response to the client.
	 * @param request The express request.
	 * @param response The express response.
	 */
	preHandle(request: Request, response: Response): boolean;

	/**
	 * This is used to perform operations before sending the response to the client.
	 * @param request The express request.
	 * @param response The express response.
	 * @param gRpcResponse The response from the gRPC call.
	 */
	postHandle(request: Request, response: Response, gRpcResponse: any): void;

	/**
	 * This is used to perform operations after completing the request and response.
	 * @param request The express request.
	 * @param response The express response.
	 * @param gRpcResponse The response from the gRPC call.
	 */
	afterCompletion(request: Request, response: Response, gRpcResponse: any): void;
}
